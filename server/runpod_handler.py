import runpod
import subprocess
import json
import os
import uuid
import shutil
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

        # Call Node.js renderer with Xvfb display - stream output in real-time
        print("Starting Node.js renderer...")
        proc = subprocess.Popen(
            ['node', '--input-type=module', '-e',
             f"import('./renderer.js').then(m => m.handler({json.dumps(event)})).then(r => console.log('RESULT:' + JSON.stringify(r)))"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,  # Line buffered
            cwd=work_dir,
            env=env
        )

        # Stream output line by line
        output_lines = []
        node_result = None
        for line in proc.stdout:
            line = line.rstrip()
            if line.startswith('RESULT:'):
                # Parse the final result
                node_result = json.loads(line[7:])
            else:
                # Print progress logs
                print(line)
                output_lines.append(line)

        returncode = proc.wait(timeout=600)

        # Stop Xvfb
        xvfb_proc.terminate()
        xvfb_proc.wait()

        if returncode != 0:
            return {'status': 'error', 'error': 'Node process failed', 'output': '\n'.join(output_lines)}

        if not node_result:
            return {'status': 'error', 'error': 'No result from Node.js', 'output': '\n'.join(output_lines)}

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
            os.remove('/tmp/input_audio.mp3')
            os.remove('/tmp/audio.pcm')
            os.remove('/tmp/output.mp4')
            # Remove frames directory
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
