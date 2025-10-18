import runpod
import subprocess
import json
import os
import uuid
from pathlib import Path
from cloud_storage import upload_file, get_public_url

def handler(event):
    try:
        # Generate unique session ID for this render job
        session_id = event.get('input', {}).get('session_id', str(uuid.uuid4()))

        work_dir = '/app' if os.path.exists('/app/renderer.js') else os.path.dirname(os.path.abspath(__file__))

        # Start Xvfb for headless WebGL rendering
        xvfb_proc = subprocess.Popen(['Xvfb', ':99', '-screen', '0', '1024x768x24'])

        # Set DISPLAY environment variable
        env = os.environ.copy()
        env['DISPLAY'] = ':99'

        # Call Node.js renderer with Xvfb display
        result = subprocess.run(
            ['node', '--input-type=module', '-e',
             f"import('./renderer.js').then(m => m.handler({json.dumps(event)})).then(r => console.log(JSON.stringify(r)))"],
            capture_output=True,
            text=True,
            timeout=600,
            cwd=work_dir,
            env=env
        )

        # Stop Xvfb
        xvfb_proc.terminate()
        xvfb_proc.wait()

        if result.returncode != 0:
            return {'status': 'error', 'error': result.stderr, 'stdout': result.stdout}

        # Parse Node.js result
        node_result = json.loads(result.stdout.strip().split('\n')[-1])

        if node_result.get('status') != 'success':
            return node_result

        # Video was generated successfully at test-output.mp4
        video_path = Path(work_dir) / 'test-output.mp4'

        if not video_path.exists():
            return {'status': 'error', 'error': 'Video file not found after generation'}

        # Upload to R2
        unique_id = str(uuid.uuid4())[:8]
        object_name = f"videos/{session_id}/{unique_id}.mp4"

        print(f"Uploading video to R2: {object_name}")
        upload_success = upload_file(video_path, object_name)

        if not upload_success:
            return {'status': 'error', 'error': 'Failed to upload video to cloud storage'}

        # Get public URL
        video_url = get_public_url(object_name)
        print(f"Video uploaded successfully: {video_url}")

        # Clean up local files
        try:
            video_path.unlink()
        except Exception as e:
            print(f"Warning: Could not delete local video file: {e}")

        # Clean up temporary files
        try:
            import os
            os.remove('/tmp/input_audio.mp3')
            os.remove('/tmp/audio.pcm')
            os.remove('/tmp/output.mp4')
            # Remove frames directory
            import shutil
            shutil.rmtree('/tmp/frames', ignore_errors=True)
        except Exception as e:
            print(f"Warning: Could not delete temp files: {e}")

        return {
            'status': 'success',
            'video_url': video_url,
            'session_id': session_id,
            'duration': node_result.get('duration')
        }

    except subprocess.TimeoutExpired:
        return {'status': 'error', 'error': 'Render timeout (>10 minutes)'}
    except Exception as e:
        import traceback
        return {
            'status': 'error',
            'error': str(e),
            'traceback': traceback.format_exc()
        }

runpod.serverless.start({'handler': handler})
