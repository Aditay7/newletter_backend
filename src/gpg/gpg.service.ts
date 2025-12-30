import { Injectable } from '@nestjs/common';
import * as openpgp from 'openpgp';

@Injectable()
export class GpgService {
  /**
   * Encrypt a message using a PGP public key
   */
  async encryptMessage(message: string, publicKeyArmored: string): Promise<string> {
    try {
      const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

      const encrypted = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: message }),
        encryptionKeys: publicKey,
      });

      return encrypted as string;
    } catch (error) {
      throw new Error(`GPG encryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt HTML email content
   */
  async encryptHtmlEmail(htmlContent: string, publicKeyArmored: string): Promise<string> {
    try {
      const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

      // For HTML, we encrypt the entire content
      const encrypted = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: htmlContent }),
        encryptionKeys: publicKey,
      });

      // Wrap encrypted content in a readable format
      return `
        <html>
          <body>
            <p>This message is encrypted with PGP/GPG.</p>
            <p>Please use your private key to decrypt the content below:</p>
            <pre style="background: #f4f4f4; padding: 10px; overflow-x: auto;">
${encrypted}
            </pre>
          </body>
        </html>
      `;
    } catch (error) {
      throw new Error(`GPG HTML encryption failed: ${error.message}`);
    }
  }

  /**
   * Validate a PGP public key
   */
  async validatePublicKey(publicKeyArmored: string): Promise<boolean> {
    try {
      const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
      return !!publicKey;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get information about a public key
   */
  async getKeyInfo(publicKeyArmored: string): Promise<any> {
    try {
      const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
      const user = publicKey.users[0];

      return {
        keyId: publicKey.getKeyID().toHex(),
        fingerprint: publicKey.getFingerprint(),
        userIds: publicKey.getUserIDs(),
        created: publicKey.getCreationTime(),
        algorithm: publicKey.getAlgorithmInfo(),
      };
    } catch (error) {
      throw new Error(`Failed to read key info: ${error.message}`);
    }
  }
}
