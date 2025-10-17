#!/usr/bin/env python3
"""
Test script for the RunPod handler
Simulates how RunPod will call the handler
"""

import json
import sys
from runpod_handler import handler

def test_handler():
    """Test the handler with sample input"""

    # Sample event that matches what RunPod will send
    test_event = {
        "input": {
            "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            "distortionType": 4,  # Glitch effect
            "trailHue": 330,  # Hot pink
            "trailSat": 100,
            "trailLight": 65,
            "svgUrl": "http://localhost:3000/raptor-svg.svg"
        },
        "id": "test-job-123"
    }

    print("🧪 Testing RunPod Handler\n")
    print("📥 Input event:")
    print(json.dumps(test_event, indent=2))
    print("\n⏳ Starting render...\n")

    try:
        result = handler(test_event)

        print("\n✅ Handler Response:")
        print(json.dumps(result, indent=2))

        if result.get('status') == 'success':
            print("\n🎉 SUCCESS!")
            video_size = len(result.get('video', ''))
            print(f"📦 Video size: {video_size / 1024 / 1024:.2f} MB (base64)")

            # Optionally save the video
            import base64
            video_data = base64.b64decode(result['video'])
            output_path = './test-runpod-output.mp4'
            with open(output_path, 'wb') as f:
                f.write(video_data)
            print(f"💾 Saved to: {output_path}")
        else:
            print("\n❌ FAILED:")
            print(f"Error: {result.get('error', 'Unknown error')}")
            if 'stdout' in result:
                print(f"\nStdout:\n{result['stdout']}")
            if 'stderr' in result:
                print(f"\nStderr:\n{result['stderr']}")
            sys.exit(1)

    except Exception as e:
        print(f"\n💥 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    test_handler()
