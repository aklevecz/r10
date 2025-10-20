#!/usr/bin/env python3
import subprocess
import json

# Test streaming output from Node.js
print("=== Testing streaming output ===\n")

event = {
    'input': {
        'audioUrl': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/ee/22/1a/ee221ab0-02dd-7290-47e7-383ad9c81e3b/mzaf_912969547193259322.plus.aac.p.m4a',
        'distortionType': 4,
        'trailHue': 330,
        'trailSat': 100,
        'trailLight': 65,
        'pngUrl': 'raptor-bw.png',
        'profile': 'legacy-server'
    }
}

proc = subprocess.Popen(
    ['node', '--input-type=module', '-e',
     f"import('./server/renderer.js').then(m => m.handler({json.dumps(event)})).then(r => console.log('RESULT:' + JSON.stringify(r)))"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1  # Line buffered
)

output_lines = []
node_result = None

for line in proc.stdout:
    line = line.rstrip()
    if line.startswith('RESULT:'):
        node_result = json.loads(line[7:])
        print(f"\n✓ Got result: {node_result.get('status')}")
    else:
        print(f"[Node] {line}")
        output_lines.append(line)

returncode = proc.wait()
print(f"\n=== Process exited with code: {returncode} ===")

if node_result:
    print(f"✓ Success! Profile: {node_result.get('profile')}")
else:
    print("✗ ERROR: No result received")
