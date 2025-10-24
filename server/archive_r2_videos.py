#!/usr/bin/env python3
"""
Script to download all videos from R2 bucket for archival purposes.
Run this before going public to backup all test videos.

Usage:
    python archive_r2_videos.py [output_directory]
"""

import sys
import os
from pathlib import Path
from cloud_storage import get_s3_client, get_env_vars

def list_all_videos(prefix='videos/'):
    """List all video files in the R2 bucket."""
    env_vars = get_env_vars()
    s3_client = get_s3_client()

    print(f"Listing all videos in bucket '{env_vars['BUCKET_NAME']}'...")

    videos = []
    paginator = s3_client.get_paginator('list_objects_v2')

    for page in paginator.paginate(Bucket=env_vars['BUCKET_NAME'], Prefix=prefix):
        if 'Contents' in page:
            for obj in page['Contents']:
                key = obj['Key']
                size = obj['Size']
                last_modified = obj['LastModified']

                # Only include .mp4 files
                if key.endswith('.mp4'):
                    videos.append({
                        'key': key,
                        'size': size,
                        'last_modified': last_modified
                    })

    print(f"Found {len(videos)} videos")
    return videos

def download_video(s3_client, bucket_name, video_key, output_dir):
    """Download a single video from R2."""
    # Create local path matching R2 structure
    local_path = Path(output_dir) / video_key
    local_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Downloading {video_key}...")

    try:
        s3_client.download_file(bucket_name, video_key, str(local_path))
        print(f"  ✓ Saved to {local_path}")
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def download_all_videos(output_dir='r2_archive'):
    """Download all videos from R2 bucket."""
    env_vars = get_env_vars()
    s3_client = get_s3_client()

    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # List all videos
    videos = list_all_videos()

    if not videos:
        print("No videos found in bucket")
        return

    # Calculate total size
    total_size = sum(v['size'] for v in videos)
    total_size_mb = total_size / (1024 * 1024)
    print(f"\nTotal size: {total_size_mb:.2f} MB")
    print(f"Download location: {output_path.absolute()}\n")

    # Confirm download
    response = input(f"Download {len(videos)} videos ({total_size_mb:.2f} MB)? (y/n): ")
    if response.lower() != 'y':
        print("Cancelled")
        return

    # Download each video
    success_count = 0
    fail_count = 0

    for i, video in enumerate(videos, 1):
        print(f"\n[{i}/{len(videos)}]")
        if download_video(s3_client, env_vars['BUCKET_NAME'], video['key'], output_dir):
            success_count += 1
        else:
            fail_count += 1

    # Summary
    print(f"\n{'='*60}")
    print(f"Download complete!")
    print(f"Success: {success_count}")
    print(f"Failed: {fail_count}")
    print(f"Location: {output_path.absolute()}")
    print(f"{'='*60}")

if __name__ == '__main__':
    output_dir = sys.argv[1] if len(sys.argv) > 1 else 'r2_archive'
    download_all_videos(output_dir)
