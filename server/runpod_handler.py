import runpod
import subprocess
import json
import os

def handler(event):
    try:
        work_dir = '/app' if os.path.exists('/app/renderer.js') else os.path.dirname(os.path.abspath(__file__))

        result = subprocess.run(
            ['node', '--input-type=module', '-e',
             f"import('./renderer.js').then(m => m.handler({json.dumps(event)})).then(r => console.log(JSON.stringify(r)))"],
            capture_output=True,
            text=True,
            timeout=600,
            cwd=work_dir
        )

        if result.returncode != 0:
            return {'status': 'error', 'error': result.stderr, 'stdout': result.stdout}

        return json.loads(result.stdout.strip().split('\n')[-1])

    except subprocess.TimeoutExpired:
        return {'status': 'error', 'error': 'Timeout'}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

runpod.serverless.start({'handler': handler})
