# RunPod Serverless Setup

## Environment Variables (RunPod Secrets)

When deploying to RunPod, you need to configure the following secrets. RunPod automatically prefixes all secrets with `RUNPOD_SECRET_`.

### Required R2 Storage Secrets

| Secret Name | Description | Example |
|------------|-------------|---------|
| `R2_ENDPOINT_URL` | Cloudflare R2 endpoint URL | `https://ACCOUNT_ID.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | R2 access key ID | Your R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret access key | Your R2 secret |
| `R2_BUCKET_NAME` | R2 bucket name | `my-video-bucket` |
| `R2_PUBLIC_URL_BASE` | Public URL base for R2 bucket | `https://videos.example.com` |

## How to Set RunPod Secrets

1. Go to your RunPod endpoint settings
2. Navigate to the "Secrets" tab
3. Add each secret with the exact names above (without the `RUNPOD_SECRET_` prefix)
4. RunPod will automatically prefix them when they're accessed in the code

## Video Storage Structure

Videos are stored in R2 with the following path structure:

```
videos/{session_id}/{unique_id}.mp4
```

- `session_id`: Optional session identifier (or auto-generated UUID)
- `unique_id`: 8-character unique identifier for each video

## API Response Format

### Success Response

```json
{
  "status": "success",
  "video_url": "https://videos.example.com/videos/abc123/def456.mp4",
  "session_id": "abc123",
  "duration": "30.5s"
}
```

### Error Response

```json
{
  "status": "error",
  "error": "Error message here",
  "traceback": "Full traceback if available"
}
```

## Local Testing

For local testing, create a `.env` file in the `/server` directory with:

```bash
RUNPOD_SECRET_R2_ENDPOINT_URL=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
RUNPOD_SECRET_R2_ACCESS_KEY_ID=your_access_key
RUNPOD_SECRET_R2_SECRET_ACCESS_KEY=your_secret_key
RUNPOD_SECRET_R2_BUCKET_NAME=your_bucket_name
RUNPOD_SECRET_R2_PUBLIC_URL_BASE=https://your-public-url.com
```

Then test with:

```bash
cd /Users/arielklevecz/r10/server
python test-runpod-handler.py < test_input.json
```

## Dependencies

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Required packages:
- `runpod` - RunPod serverless SDK
- `boto3` - AWS S3/R2 SDK
- `python-dotenv` - Environment variable loader
