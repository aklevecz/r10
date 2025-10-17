import runpod
import subprocess
import json
import base64
import os

def handler(event):
    """
    RunPod handler that calls the Node.js renderer
    """
    try:
        input_data = event.get('input', {})
        
        # Write input to temp file
        input_file = '/tmp/input.json'
        with open(input_file, 'w') as f:
            json.dump({'input': input_data}, f)
        
        # Call Node.js script
        result = subprocess.run(
            ['node', '/app/r10-server-renderer.js', input_file],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode != 0:
            return {
                'error': f'Renderer failed: {result.stderr}',
                'stdout': result.stdout
            }
        
        # Read output video
        output_path = '/tmp/output.mp4'
        if os.path.exists(output_path):
            with open(output_path, 'rb') as f:
                video_data = base64.b64encode(f.read()).decode('utf-8')
            
            # Clean up
            os.remove(output_path)
            
            return {
                'status': 'success',
                'video': video_data,
                'message': 'Video generated successfully'
            }
        else:
            return {
                'error': 'Output video not found',
                'stdout': result.stdout,
                'stderr': result.stderr
            }
    
    except subprocess.TimeoutExpired:
        return {'error': 'Rendering timeout (5 minutes)'}
    except Exception as e:
        return {'error': str(e)}

runpod.serverless.start({'handler': handler})
