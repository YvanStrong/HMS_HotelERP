package com.hms.ebm;

import com.hms.config.HmsEbmProperties;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/** AES-GCM envelope for EBM device signing keys at rest. */
@Component
public class EbmKeyCrypto {

    private static final String PREFIX = "ebm1:";
    private final byte[] keyBytes;

    public EbmKeyCrypto(HmsEbmProperties properties) {
        this.keyBytes = deriveKey(properties.getKeyEncryptionSecret());
    }

    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            return null;
        }
        try {
            byte[] iv = new byte[12];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "AES"), new GCMParameterSpec(128, iv));
            byte[] cipherText = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            ByteBuffer buf = ByteBuffer.allocate(iv.length + cipherText.length);
            buf.put(iv);
            buf.put(cipherText);
            return PREFIX + Base64.getEncoder().encodeToString(buf.array());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt EBM signing key", e);
        }
    }

    public String decrypt(String stored) {
        if (stored == null || stored.isBlank()) {
            return null;
        }
        if (!stored.startsWith(PREFIX)) {
            // Legacy / plaintext fallback (should not be used in production)
            return stored;
        }
        try {
            byte[] raw = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            byte[] iv = new byte[12];
            byte[] cipherText = new byte[raw.length - 12];
            System.arraycopy(raw, 0, iv, 0, 12);
            System.arraycopy(raw, 12, cipherText, 0, cipherText.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(keyBytes, "AES"), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to decrypt EBM signing key", e);
        }
    }

    private static byte[] deriveKey(String secret) {
        try {
            String seed = (secret == null || secret.isBlank())
                    ? "hms-ebm-dev-only-change-me"
                    : secret;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(seed.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
