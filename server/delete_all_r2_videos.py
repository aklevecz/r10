#!/usr/bin/env python3
"""
Script to DELETE all videos from R2 bucket.
WARNING: This is destructive and cannot be undone!

Use this after archiving videos to start with a clean slate.

Usage:
    python delete_all_r2_videos.py
"""

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
                if key.endswith('.mp4'):
                    videos.append(key)

    print(f"Found {len(videos)} videos")
    return videos

def delete_all_videos():
    """Delete all videos from R2 bucket."""
    env_vars = get_env_vars()
    s3_client = get_s3_client()

    # List all videos
    videos = list_all_videos()

    if not videos:
        print("No videos found in bucket")
        return

    print(f"\n{'='*60}")
    print(f"WARNING: This will DELETE {len(videos)} videos from R2!")
    print(f"Bucket: {env_vars['BUCKET_NAME']}")
    print(f"This action CANNOT be undone!")
    print(f"{'='*60}\n")

    # Show first 5 videos as examples
    print("Examples of videos to be deleted:")
    for video in videos[:5]:
        print(f"  - {video}")
    if len(videos) > 5:
        print(f"  ... and {len(videos) - 5} more")

    # Confirm deletion (require typing DELETE)
    print("\nTo confirm, type 'DELETE' (in all caps):")
    response = input("> ")

    if response != 'DELETE':
        print("Cancelled")
        return

    # Double confirm
    print("\nAre you absolutely sure? (y/n):")
    final_confirm = input("> ")

    if final_confirm.lower() != 'y':
        print("Cancelled")
        return

    # Delete each video
    success_count = 0
    fail_count = 0

    print("\nDeleting videos...")
    for i, video_key in enumerate(videos, 1):
        print(f"[{i}/{len(videos)}] Deleting {video_key}...")
        try:
            s3_client.delete_object(
                Bucket=env_vars['BUCKET_NAME'],
                Key=video_key
            )
            success_count += 1
            print(f"  ✓ Deleted")
        except Exception as e:
            print(f"  ✗ Error: {e}")
            fail_count += 1

    # Summary
    print(f"\n{'='*60}")
    print(f"Deletion complete!")
    print(f"Deleted: {success_count}")
    print(f"Failed: {fail_count}")
    print(f"{'='*60}")

if __name__ == '__main__':
    delete_all_videos()
