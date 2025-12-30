import * as crypto from 'crypto';

export class SignedUrlService {
  private readonly secret: string;
  private readonly algorithm = 'sha256';

  constructor(secret?: string) {
    this.secret = secret || process.env.SIGNED_URL_SECRET || 'your-secret-key-change-this';
  }

  /**
   * Generate a signed URL token
   */
  generateToken(data: string, expiresAt: number): string {
    const payload = `${data}:${expiresAt}`;
    const signature = crypto
      .createHmac(this.algorithm, this.secret)
      .update(payload)
      .digest('hex');

    return `${Buffer.from(payload).toString('base64')}.${signature}`;
  }

  /**
   * Verify and decode a signed URL token
   */
  verifyToken(token: string): { data: string; valid: boolean; expired: boolean } {
    try {
      const [payloadBase64, signature] = token.split('.');
      const payload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const [data, expiresAtStr] = payload.split(':');
      const expiresAt = parseInt(expiresAtStr, 10);

      // Verify signature
      const expectedSignature = crypto
        .createHmac(this.algorithm, this.secret)
        .update(payload)
        .digest('hex');

      if (signature !== expectedSignature) {
        return { data: '', valid: false, expired: false };
      }

      // Check expiration
      const now = Date.now();
      if (now > expiresAt) {
        return { data, valid: false, expired: true };
      }

      return { data, valid: true, expired: false };
    } catch (error) {
      return { data: '', valid: false, expired: false };
    }
  }

  /**
   * Create a signed tracking URL
   */
  createTrackingUrl(
    baseUrl: string,
    campaignId: string,
    subscriberId: string,
    linkId: string,
    expiresInDays: number = 30,
  ): string {
    const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
    const data = `${campaignId}:${subscriberId}:${linkId}`;
    const token = this.generateToken(data, expiresAt);

    return `${baseUrl}/track/${token}`;
  }

  /**
   * Parse tracking URL token
   */
  parseTrackingToken(token: string): {
    campaignId: string;
    subscriberId: string;
    linkId: string;
    valid: boolean;
    expired: boolean;
  } {
    const result = this.verifyToken(token);

    if (!result.valid) {
      return {
        campaignId: '',
        subscriberId: '',
        linkId: '',
        valid: false,
        expired: result.expired,
      };
    }

    const [campaignId, subscriberId, linkId] = result.data.split(':');

    return {
      campaignId,
      subscriberId,
      linkId,
      valid: true,
      expired: false,
    };
  }
}
