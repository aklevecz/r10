#!/bin/bash

# Test the Docker container locally by simulating RunPod handler

docker run --rm \
  -e RUNPOD_SECRET_R2_ENDPOINT_URL=https://51f8bc25fa28f29dafad8fac5d55a08a.r2.cloudflarestorage.com \
  -e RUNPOD_SECRET_R2_ACCESS_KEY_ID=4f7abeb629a0bfdb136b56d988a5a704 \
  -e RUNPOD_SECRET_R2_SECRET_ACCESS_KEY=11a666a986f09d1cd284ba32d07697dfa3b179cf0f38c3d131ab536f25ffe6e2 \
  -e RUNPOD_SECRET_R2_BUCKET_NAME=r10 \
  -e RUNPOD_SECRET_R2_PUBLIC_URL_BASE=https://pub-323981ac24db40a7bd09be667b4ed3c7.r2.dev \
  r10-server:test \
  python3 -c "
import json
from runpod_handler import handler

event = {
    'input': {
        'audioUrl': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/ee/22/1a/ee221ab0-02dd-7290-47e7-383ad9c81e3b/mzaf_912969547193259322.plus.aac.p.m4a',
        'distortionType': 4,
        'trailHue': 330,
        'trailSat': 100,
        'trailLight': 65,
        'pngUrl': 'raptor-bw.png'
    }
}

result = handler(event)
print(json.dumps(result, indent=2))
"
