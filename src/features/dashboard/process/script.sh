#!/system/bin/sh

json_response() {
  success="$1"
  data="$2"
  error="$3"
  printf '{"success": %s, "data": %s, "error": %s}\n' "$success" "$data" "$error"
}

read_file() {
    filepath="$1"
    if [ -f "$filepath" ]; then
        content=$(cat "$filepath")
        json_response "true" "$content" "null"
    else
        json_response "false" "null" "\"File not found: $filepath\""
    fi
}

write_file() {
    filepath="$1"
    content="$2"

    dirpath="$(dirname "$filepath")"

    mkdir -p "$dirpath" || {
        json_response "false" "false" "\"Failed to create directory: $dirpath\""
        return
    }

    printf '%s\n' "$content" > "$filepath"
    if [ $? -eq 0 ]; then
        json_response "true" "true" "null"
    else
        json_response "false" "false" "\"Failed to write to file: $filepath\""
    fi
}

scan_media_app_packages() {
  file_type="$1"
  source_folder="$2"

  if [ ! -d "$source_folder" ]; then
    json_response "false" "[]" "\"Source folder does not exist: $source_folder\""
    return 1
  fi

  package_list=$(find "$source_folder" -maxdepth 1 -type f -name "*_*.$file_type" ! -name ".trashed*" 2>/dev/null \
    | grep -vE "_[0-9]+\.${file_type}" \
    | sed -n "s/.*_\(.*\).${file_type}/\1/p" \
    | sed 's/\[[^]]*\]//g' \
    | sed 's/[[:space:]]*$//' \
    | sed 's/-[a-z][a-z0-9]*$//' \
    | sort -u)

  if [ -z "$package_list" ]; then
    json_response "true" "[]" "null"
    return 0
  fi

  json_array=$(echo "$package_list" | sed 's/\\/\\\\/g; s/"/\\"/g; s/^/"/; s/$/"/; H; $!d; x; s/\n/,/g; s/^,//')

  json_response "true" "[$json_array]" "null"
}

count_media_items() {
  file_type="$1"
  source_folder="$2"

  if [ ! -d "$source_folder" ]; then
    json_response "true" "0" "null"
    return 0
  fi

  item_count=$(find "$source_folder" -maxdepth 1 -type f \
    -name "*_*.$file_type" \
    ! -name ".trashed*" \
    2>/dev/null \
    | grep -vE "_[0-9]+\.${file_type}$" \
    | wc -l | tr -d ' \t')

  json_response "true" "${item_count:-0}" "null"
}

create_app_media_folders() {
  app_list_json="$1"
  dest_folder="$2"
  created_count=0

  if [ ! -d "$dest_folder" ]; then
    mkdir -p "$dest_folder"
  fi

  app_list=$(echo "$app_list_json" | tr -d '[]"' | tr ',' '\n')

  while IFS= read -r app_name; do
    if [ -n "$app_name" ]; then
      folder_path="$dest_folder/$app_name"
      if [ ! -d "$folder_path" ]; then
        mkdir -p "$folder_path"
        if [ $? -eq 0 ]; then
          created_count=$((created_count + 1))
        fi
      fi
    fi
  done << EOF
$app_list
EOF

  json_response "true" "{\"created\": $created_count}" "null"
}

run_batch_command() {
    count_command="$1"
    move_command="$2"

    count=$(eval "$count_command" 2>/dev/null)
    count=$(echo "$count" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    count=${count:-0}

    if [ "$count" -eq 0 ]; then
        json_response "true" "{\"moved\": 0, \"total\": 0}" "null"
        return 0
    fi
    
    eval "$move_command" 2>/dev/null
    
    remaining=$(eval "$count_command" 2>/dev/null)
    remaining=$(echo "$remaining" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    remaining=${remaining:-0}
    
    moved_count=$((count - remaining))
    
    if [ $moved_count -eq $count ]; then
        json_response "true" "{\"moved\": $moved_count, \"total\": $count}" "null"
    else
        failed_count=$((count - moved_count))
        json_response "true" "{\"moved\": $moved_count, \"total\": $count, \"failed\": $failed_count}" "{\"message\": \"$failed_count arquivos não foram movidos\"}"
    fi
}

find_expired_files() {
    folder_path="$1"
    days="$2"
    extension="$3"

    if [ ! -d "$folder_path" ]; then
        json_response "false" "[]" "\"Folder not found: $folder_path\""
        return 1
    fi

    file_list=$(find "$folder_path" -type f -name "*.$extension" -mtime "+$days" 2>/dev/null)

    if [ -z "$file_list" ]; then
        json_response "true" "[]" "null"
        return 0
    fi
    
    json_array=""
    while IFS= read -r file; do
        escaped_file=$(printf "%s" "$file" | sed 's/\\/\\\\/g; s/"/\\"/g')
        if [ -z "$json_array" ]; then
            json_array="\"$escaped_file\""
        else
            json_array="$json_array,\"$escaped_file\""
        fi
    done << EOF
$file_list
EOF

    json_response "true" "[$json_array]" "null"
}

delete_files_batch() {
    files_json="$1"

    deleted_count=0

    if [ -z "$files_json" ] || [ "$files_json" = "[]" ]; then
        json_response "true" "{\"deleted\": 0}" "null"
        return 0
    fi

    file_list=$(printf '%s' "$files_json" | sed 's/^\["//; s/"\]$//; s/","/\n/g')

    while IFS= read -r file_path; do
        clean_path=$(echo "$file_path" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/\\\\/\\/g')
        
        if [ -n "$clean_path" ] && [ -f "$clean_path" ]; then
            rm "$clean_path" 2>/dev/null
            if [ $? -eq 0 ]; then
                deleted_count=$((deleted_count + 1))
            fi
        fi
    done << EOF
$file_list
EOF

    json_response "true" "{\"deleted\": $deleted_count}" "null"
}

delete_folder_contents() {
  folder_path="$1"

  if [ ! -d "$folder_path" ]; then
    json_response "false" "{\"deleted\": 0, \"mtime\": null}" "\"Folder does not exist: $folder_path\""
    return 1
  fi

  initial_count=$(cd "$folder_path" && ls -1 2>/dev/null | wc -l)
  
  rm "$folder_path"/* 2>/dev/null
  
  remaining_count=$(cd "$folder_path" && ls -1 2>/dev/null | wc -l)
  
  deleted_count=$((initial_count - remaining_count))
  
  folder_mtime=$(stat -c %Y "$folder_path" 2>/dev/null)
  
  json_response "true" "{\"deleted\": $deleted_count, \"mtime\": $folder_mtime}" "null"
}

get_subfolders() {
  base_path="$1"

  if [ ! -d "$base_path" ]; then
    json_response "false" "[]" "\"Base path does not exist: $base_path\""
    return 1
  fi

  subfolder_list=$(find "$base_path" -mindepth 1 -maxdepth 1 -type d -printf "%f,%T@\n" 2>/dev/null | sed 's/\([0-9]\{10\}\)\.[0-9]*/\1/')

  if [ -z "$subfolder_list" ]; then
    json_response "true" "[]" "null"
    return 0
  fi

  json_array=""
  first=true

  while IFS= read -r line; do
    escaped_line=$(printf "%s" "$line" | sed 's/\\/\\\\/g; s/"/\\"/g')

    if [ "$first" = true ]; then
      first=false
    else
      json_array="$json_array,"
    fi

    json_array="$json_array\"$escaped_line\""
  done << EOF
$subfolder_list
EOF

  json_response "true" "[$json_array]" "null"
}

count_subfolders() {
  base_path="$1"

  if [ ! -d "$base_path" ]; then
    json_response "true" "0" "null"
    return 0
  fi

  folder_count=$(find "$base_path" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  folder_count=$(echo "$folder_count" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  folder_count=${folder_count:-0}

  json_response "true" "$folder_count" "null"
}

get_item_counts_batch() {
  base_path="$1"
  subfolders_json="$2"

  if [ ! -d "$base_path" ]; then
    json_response "false" "[]" "\"Base path does not exist: $base_path\""
    return 1
  fi

  subfolder_list=$(echo "$subfolders_json" | tr -d '[]"' | tr ',' '\n')

  json_array=""
  first=true
  
  {
    cd "$base_path" || return 1
    while IFS= read -r folder_name; do
      folder_name=$(echo "$folder_name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      
      if [ -n "$folder_name" ] && [ -d "$folder_name" ]; then
          count=$(ls -1 "$folder_name" 2>/dev/null | wc -l)
          count=$(echo "$count" | tr -d ' ')
          escaped=$(printf "%s,%s" "$folder_name" "$count" | sed 's/\\/\\\\/g; s/"/\\"/g')

          if [ "$first" = true ]; then
              first=false
          else
              json_array="$json_array,"
          fi
          json_array="$json_array\"$escaped\""
      fi
    done << EOF
$subfolder_list
EOF
  }
  
  json_response "true" "[$json_array]" "null"
}

rename_folder() {
  base_path="$1"
  old_name="$2"
  new_name="$3"

  old_path="$base_path/$old_name"
  new_path="$base_path/$new_name"

  if [ -d "$old_path" ] && [ "$old_name" != "$new_name" ]; then
    
    if [ -d "$new_path" ]; then
      mv "$old_path"/* "$new_path"/ 2>/dev/null && rmdir "$old_path"
    else
      mv "$old_path" "$new_path"
    fi

    if [ $? -eq 0 ]; then
      new_ts=$(stat -c %Y "$new_path")
      json_response "true" "{\"renamed\": true, \"timestamp\": $new_ts}" "null"
    else
      json_response "false" "null" "\"Falha ao renomear/mesclar $old_name\""
    fi
  else
    json_response "true" "{\"renamed\": false, \"timestamp\": null}" "null"
  fi
}

get_media_stats() {
  dir="$1"
  ext="$2"

  if [ ! -d "$dir" ]; then
    json_response "true" "{\"pending\":0,\"tagged\":0,\"skipped\":0}" "null"
    return 0
  fi

  total=$(find "$dir" -type f -iname "*.${ext}" 2>/dev/null | wc -l | tr -d ' \t')
  skipped=$(find "$dir" -type f -iname "*\[skip\]*.${ext}" 2>/dev/null | wc -l | tr -d ' \t')
  bracketed=$(find "$dir" -type f -iname "*\[*\]*.${ext}" 2>/dev/null | wc -l | tr -d ' \t')

  tagged=$((bracketed - skipped))
  pending=$((total - bracketed))
  [ "$tagged" -lt 0 ] && tagged=0
  [ "$pending" -lt 0 ] && pending=0

  json_response "true" "{\"pending\":$pending,\"tagged\":$tagged,\"skipped\":$skipped}" "null"
}

get_pending_media() {
  dir="$1"

  if [ ! -d "$dir" ]; then
    json_response "true" "{\"files\":[]}" "null"
    return 0
  fi

  json_array=$(find "$dir" -type f ! -name "*\[*" -printf '"%P"\n' 2>/dev/null | sort | \
    paste -sd ',')

  json_response "true" "{\"files\":[${json_array}]}" "null"
}

list_media_in_folder() {
  folder_path="$1"

  if [ ! -d "$folder_path" ]; then
    json_response "true" "{\"files\":[]}" "null"
    return 0
  fi

  json_array=$(find "$folder_path" -maxdepth 1 -type f -printf '"%f"\n' 2>/dev/null | sort | \
    paste -sd ',')

  json_response "true" "{\"files\":[${json_array}]}" "null"
}

search_media_by_tag() {
  dir="$1"
  raw_query="$2"

  if [ ! -d "$dir" ] || [ -z "$raw_query" ]; then
    json_response "true" "{\"files\":[]}" "null"
    return 0
  fi

  query=$(echo "$raw_query" | tr ' ' '-')

  json_array=$(find "$dir" -type f -iname "*\[*${query}*\]*" \
    -printf '{"path":"%p","name":"%f"}\n' 2>/dev/null | sort | \
    paste -sd ',')

  json_response "true" "{\"files\":[${json_array}]}" "null"
}


skip_screenshot() {
  file_path="$1"

  if [ ! -f "$file_path" ]; then
    json_response "false" "null" "\"File not found: $file_path\""
    return 1
  fi

  dir=$(dirname "$file_path")
  name=$(basename "$file_path")
  ext="${name##*.}"
  base="${name%.*}"
  base_clean=$(echo "$base" | sed 's/\[[^]]*\]//g' | sed 's/[[:space:]]*$//')
  new_name="${base_clean}[skip].${ext}"
  new_path="${dir}/${new_name}"

  mv "$file_path" "$new_path"

  if [ $? -eq 0 ]; then
    escaped=$(printf "%s" "$new_path" | sed 's/\\/\\\\/g; s/"/\\"/g')
    json_response "true" "{\"newPath\":\"${escaped}\"}" "null"
  else
    json_response "false" "null" "\"Failed to rename file\""
  fi
}

apply_tags_to_filename() {
  file_path="$1"
  tags_csv="$2"

  if [ ! -f "$file_path" ]; then
    json_response "false" "null" "\"File not found: $file_path\""
    return 1
  fi

  dir=$(dirname "$file_path")
  name=$(basename "$file_path")
  ext="${name##*.}"
  base="${name%.*}"
  base_clean=$(echo "$base" | sed 's/\[[^]]*\]//g' | sed 's/[[:space:]]*$//')
  tag_str=$(echo "$tags_csv" | tr ',' '\n' | while IFS= read -r tag; do
    echo "$tag" | sed 's/[[:space:]]/-/g; s/-\+/-/g; s/^-//; s/-$//'
  done | paste -sd '_')
  new_name="${base_clean}[${tag_str}].${ext}"
  new_path="${dir}/${new_name}"

  mv "$file_path" "$new_path"

  if [ $? -eq 0 ]; then
    escaped=$(printf "%s" "$new_path" | sed 's/\\/\\\\/g; s/"/\\"/g')
    json_response "true" "{\"newPath\":\"${escaped}\"}" "null"
  else
    json_response "false" "null" "\"Failed to rename file\""
  fi
}

clear_tags_from_filename() {
  file_path="$1"

  if [ ! -f "$file_path" ]; then
    json_response "false" "null" "\"File not found: $file_path\""
    return 1
  fi

  dir=$(dirname "$file_path")
  name=$(basename "$file_path")
  ext="${name##*.}"
  base="${name%.*}"
  base_clean=$(echo "$base" | sed 's/\[[^]]*\]//g' | sed 's/[[:space:]]*$//')
  new_path="${dir}/${base_clean}.${ext}"

  mv "$file_path" "$new_path"

  if [ $? -eq 0 ]; then
    escaped=$(printf "%s" "$new_path" | sed 's/"/\\"/g')
    json_response "true" "{\"newPath\":\"${escaped}\"}" "null"
  else
    json_response "false" "null" "\"Failed to rename file\""
  fi
}


main() {
  command="$1"
  shift
  case "$command" in
    read_file)
      read_file "$1"
      ;;
    write_file)
      write_file "$1" "$2"
      ;;
    scan_media_app_packages)
      scan_media_app_packages "$1" "$2"
      ;;
    count_media_items)
      count_media_items "$1" "$2"
      ;;
    create_app_media_folders)
      create_app_media_folders "$1" "$2"
      ;;
    run_batch_command)
      run_batch_command "$1" "$2"
      ;;
    find_expired_files)
      find_expired_files "$1" "$2" "$3"
      ;;
    delete_files_batch)
      delete_files_batch "$1"
      ;;
    get_subfolders)
      get_subfolders "$1"
      ;;
    count_subfolders)
      count_subfolders "$1"
      ;;
    get_item_counts_batch)
      get_item_counts_batch "$1" "$2"
      ;;
    rename_folder)
      rename_folder "$1" "$2" "$3"
      ;;
    delete_folder_contents)
      delete_folder_contents "$1"
      ;;
    get_media_stats)
      get_media_stats "$1" "$2"
      ;;
    get_pending_media)
      get_pending_media "$1"
      ;;
    list_media_in_folder)
      list_media_in_folder "$1"
      ;;
    search_media_by_tag)
      search_media_by_tag "$1" "$2"
      ;;
    skip_screenshot)
      skip_screenshot "$1"
      ;;
    apply_tags_to_filename)
      apply_tags_to_filename "$1" "$2"
      ;;
    clear_tags_from_filename)
      clear_tags_from_filename "$1"
      ;;
    *)
      json_response "false" "{}" "\"Unknown command: $command\""
      exit 1
      ;;
  esac
}

main "$@"
