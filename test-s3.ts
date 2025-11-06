import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function test() {
  const bucketName = process.env.S3_BUCKET;
  if (!bucketName) {
    console.error('❌ S3_BUCKET không được cấu hình trong .env');
    return;
  }

  try {
    // Test kết nối bằng cách kiểm tra bucket có tồn tại và có quyền truy cập không
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log('✅ Kết nối S3 thành công!');
    console.log(`✅ Bucket "${bucketName}" có thể truy cập được`);
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.error(`❌ Bucket "${bucketName}" không tồn tại`);
    } else if (error.name === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
      console.error(`❌ Không có quyền truy cập bucket "${bucketName}"`);
      console.error('   Kiểm tra lại IAM policy của user');
    } else {
      console.error('❌ Lỗi kết nối S3:', error.message);
    }
  }
}

test();