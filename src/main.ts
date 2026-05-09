import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: 'http://localhost:5173' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe());
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });
  app.useStaticAssets(join(__dirname, '..', 'uploads/temp'), {
    prefix: '/uploads/temp',
  });
  app.useStaticAssets(join(__dirname, '..', 'uploads/approved'), {
    prefix: '/uploads/approved',
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
