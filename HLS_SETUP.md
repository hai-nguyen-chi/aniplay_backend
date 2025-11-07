# HLS Streaming Setup Guide

## Overview
Hệ thống hỗ trợ HLS (HTTP Live Streaming) với adaptive bitrate streaming sử dụng **FFmpeg** (miễn phí, chạy trên server).

## Prerequisites

### 1. Install FFmpeg
**Windows:**
```bash
# Sử dụng Chocolatey
choco install ffmpeg

# Hoặc download từ https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

### 2. Install Node.js packages
```bash
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg @types/fluent-ffmpeg
```

### 3. Environment Variables
Cấu hình S3 để lưu trữ video và HLS segments:

```env
# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=your-bucket-name
```

### 4. Verify FFmpeg Installation
```bash
ffmpeg -version
```

Nếu FFmpeg đã được cài đặt, bạn sẽ thấy version information.

## Usage

### 1. Upload Video (Auto-trigger transcoding)
```bash
POST /episodes/:id/upload-video
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form data:
- video: <file>
```

Transcoding sẽ tự động bắt đầu sau khi upload.

### 2. Manual Transcoding
```bash
POST /episodes/:id/transcode?qualities=360p,480p,720p,1080p
Authorization: Bearer <token>
```

### 3. Check Transcoding Status
```bash
GET /episodes/:id/transcode/status
Authorization: Bearer <token>
```

### 4. Stream HLS Video
```html
<video controls>
  <source src="/episodes/:id/hls/master.m3u8" type="application/x-mpegURL">
</video>
```

## API Endpoints

### HLS Streaming
- `GET /episodes/:id/hls/master.m3u8` - Master manifest
- `GET /episodes/:id/hls/:quality.m3u8` - Variant manifest
- `GET /episodes/:id/hls/:quality/:segment` - Segment file

### Transcoding
- `POST /episodes/:id/transcode` - Start transcoding
- `GET /episodes/:id/transcode/status` - Check status
- `POST /episodes/transcode/callback` - Webhook for job completion

## Quality Levels

Default qualities:
- **360p**: 640x360, 500 kbps
- **480p**: 854x480, 1 Mbps
- **720p**: 1280x720, 2.5 Mbps
- **1080p**: 1920x1080, 5 Mbps

## Workflow
1. **Upload Video** → Video được upload lên S3
2. **Trigger Transcoding** → FFmpeg job được tạo (chạy trên server)
3. **Download Video** → Video được download từ S3 về temp directory
4. **Processing** → FFmpeg transcode video thành HLS segments cho mỗi quality
5. **Upload Segments** → Segments và manifests được upload lên S3
6. **Generate Manifests** → Master manifest được tạo và upload
7. **Cleanup** → Temp files được xóa
8. **Update Episode** → Episode được update với HLS manifest URLs
9. **Stream** → Client có thể stream video với adaptive bitrate

## Troubleshooting

### FFmpeg Issues

#### FFmpeg Not Found
- Kiểm tra FFmpeg đã được cài đặt: `ffmpeg -version`
- Nếu dùng `@ffmpeg-installer/ffmpeg`, package sẽ tự động cài FFmpeg binary
- Hoặc cài FFmpeg system-wide (khuyến nghị)

#### Transcoding Fails
- Kiểm tra server có đủ disk space (cần ít nhất 2-3x kích thước video)
- Kiểm tra server có đủ RAM
- Xem logs để biết lỗi cụ thể từ FFmpeg
- Kiểm tra video input có hợp lệ không

#### Out of Memory
- Giảm số lượng qualities cùng lúc
- Tăng server RAM
- Giảm số lượng video transcode đồng thời

### Common Issues

#### Segments Not Found
- Đợi transcoding hoàn thành (check status)
- Kiểm tra S3 bucket có segments không
- Kiểm tra manifest URLs

#### Manifest Generation Fails
- Kiểm tra segments đã được tạo chưa
- Kiểm tra S3 permissions
- Xem logs để biết lỗi cụ thể

## Cost Estimation

### FFmpeg:
- **Miễn phí** (chỉ tốn tài nguyên server)
- Cần server có đủ CPU và disk space
- Tốc độ phụ thuộc vào server hardware
- Khuyến nghị: Server có ít nhất 2 CPU cores và 4GB RAM cho video HD

## Next Steps

1. Implement retry logic cho failed jobs
2. Add queue system (Bull/SQS) cho high volume transcoding
3. Implement CDN (CloudFront) cho better performance
4. Add DRM support nếu cần
5. Monitor server resources (CPU, RAM, disk) khi transcode
6. Setup auto-cleanup cho temp files và old segments

