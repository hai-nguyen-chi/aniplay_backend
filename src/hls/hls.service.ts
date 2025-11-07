import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface HLSVariant {
  manifestUrl: string;
  resolution: string;
  bandwidth: number;
  codecs?: string;
  frameRate?: number;
}

export interface HLSSegment {
  url: string;
  duration: number;
  sequence: number;
}

@Injectable()
export class HLSService {
  constructor(private configService: ConfigService) {}

  /**
   * Generate master manifest (.m3u8) for HLS
   * @param variants - Array of variant streams
   * @param baseUrl - Base URL for manifest and segments
   * @returns Master manifest content
   */
  generateMasterManifest(variants: HLSVariant[], baseUrl?: string): string {
    const lines: string[] = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-INDEPENDENT-SEGMENTS',
    ];

    // Sort variants by bandwidth (lowest first)
    const sortedVariants = [...variants].sort((a, b) => a.bandwidth - b.bandwidth);

    for (const variant of sortedVariants) {
      const manifestUrl = baseUrl ? this.resolveUrl(variant.manifestUrl, baseUrl) : variant.manifestUrl;
      
      lines.push('#EXT-X-STREAM-INF:BANDWIDTH=' + variant.bandwidth);
      if (variant.resolution) {
        const [width, height] = variant.resolution.replace('p', '').split('x');
        if (width && height) {
          lines.push(`RESOLUTION=${width}x${height}`);
        } else {
          // Handle "720p" format
          const heightNum = parseInt(variant.resolution.replace('p', ''));
          if (heightNum) {
            const widthNum = Math.round((heightNum * 16) / 9); // Assume 16:9
            lines.push(`RESOLUTION=${widthNum}x${heightNum}`);
          }
        }
      }
      if (variant.codecs) {
        lines.push(`CODECS="${variant.codecs}"`);
      }
      if (variant.frameRate) {
        lines.push(`FRAME-RATE=${variant.frameRate}`);
      }
      lines.push(manifestUrl);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Generate variant manifest (.m3u8) for a specific quality
   * @param segments - Array of video segments
   * @param targetDuration - Maximum segment duration
   * @param mediaSequence - Starting sequence number
   * @param playlistType - 'VOD' for video on demand, 'EVENT' for live
   * @returns Variant manifest content
   */
  generateVariantManifest(
    segments: HLSSegment[],
    targetDuration: number = 10,
    mediaSequence: number = 0,
    playlistType: 'VOD' | 'EVENT' = 'VOD',
  ): string {
    const lines: string[] = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${targetDuration}`,
      `#EXT-X-MEDIA-SEQUENCE:${mediaSequence}`,
    ];

    if (playlistType === 'VOD') {
      lines.push('#EXT-X-PLAYLIST-TYPE:VOD');
    }

    for (const segment of segments) {
      lines.push(`#EXTINF:${segment.duration.toFixed(3)},`);
      lines.push(segment.url);
    }

    if (playlistType === 'VOD') {
      lines.push('#EXT-X-ENDLIST');
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Parse master manifest to extract variants
   * @param manifestContent - Master manifest content
   * @returns Array of variant information
   */
  parseMasterManifest(manifestContent: string): HLSVariant[] {
    const variants: HLSVariant[] = [];
    const lines = manifestContent.split('\n').map(l => l.trim()).filter(l => l);

    let currentVariant: Partial<HLSVariant> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        currentVariant = {};
        const params = this.parseStreamInf(line);

        if (params.BANDWIDTH) {
          currentVariant.bandwidth = parseInt(params.BANDWIDTH, 10);
        }
        if (params.RESOLUTION) {
          const [width, height] = params.RESOLUTION.split('x');
          currentVariant.resolution = `${height}p`;
        }
        if (params.CODECS) {
          currentVariant.codecs = params.CODECS.replace(/"/g, '');
        }
        if (params['FRAME-RATE']) {
          currentVariant.frameRate = parseFloat(params['FRAME-RATE']);
        }
      } else if (currentVariant && !line.startsWith('#')) {
        // This is the manifest URL
        currentVariant.manifestUrl = line;
        if (currentVariant.bandwidth && currentVariant.resolution) {
          variants.push(currentVariant as HLSVariant);
        }
        currentVariant = null;
      }
    }

    return variants;
  }

  /**
   * Parse variant manifest to extract segments
   * @param manifestContent - Variant manifest content
   * @returns Array of segment information
   */
  parseVariantManifest(manifestContent: string): HLSSegment[] {
    const segments: HLSSegment[] = [];
    const lines = manifestContent.split('\n').map(l => l.trim()).filter(l => l);

    let sequence = 0;
    let currentDuration = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('#EXTINF:')) {
        const durationMatch = line.match(/#EXTINF:([\d.]+)/);
        if (durationMatch) {
          currentDuration = parseFloat(durationMatch[1]);
        }
      } else if (currentDuration > 0 && !line.startsWith('#')) {
        segments.push({
          url: line,
          duration: currentDuration,
          sequence: sequence++,
        });
        currentDuration = 0;
      }
    }

    return segments;
  }

  /**
   * Resolve relative URL to absolute URL
   */
  private resolveUrl(url: string, baseUrl: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
  }

  /**
   * Parse EXT-X-STREAM-INF parameters
   */
  private parseStreamInf(line: string): Record<string, string> {
    const params: Record<string, string> = {};
    const content = line.replace('#EXT-X-STREAM-INF:', '');
    const parts = content.split(',');

    for (const part of parts) {
      const [key, value] = part.split('=').map(s => s.trim());
      if (key && value) {
        params[key] = value;
      }
    }

    return params;
  }

  /**
   * Get default quality configurations
   */
  getDefaultQualityConfigs(): Array<{ quality: string; resolution: string; bandwidth: number; codecs: string }> {
    return [
      {
        quality: '360p',
        resolution: '360p',
        bandwidth: 500 * 1000, // 500 kbps
        codecs: 'avc1.42e01e,mp4a.40.2',
      },
      {
        quality: '480p',
        resolution: '480p',
        bandwidth: 1000 * 1000, // 1 Mbps
        codecs: 'avc1.42e01e,mp4a.40.2',
      },
      {
        quality: '720p',
        resolution: '720p',
        bandwidth: 2500 * 1000, // 2.5 Mbps
        codecs: 'avc1.4d001f,mp4a.40.2',
      },
      {
        quality: '1080p',
        resolution: '1080p',
        bandwidth: 5000 * 1000, // 5 Mbps
        codecs: 'avc1.640028,mp4a.40.2',
      },
    ];
  }
}

