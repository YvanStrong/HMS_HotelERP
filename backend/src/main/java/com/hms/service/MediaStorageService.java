package com.hms.service;

import com.hms.web.ApiException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MediaStorageService {

    private static final long MAX_BYTES = 3_000_000L;
    private static final Path ROOT = Paths.get("C:\\Users\\Administrator\\Documents\\HMS_HotelERP\\uploads");

    public Map<String, String> storeUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Choose an image file.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Image is too large. Use a photo under 3 MB.");
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!contentType.startsWith("image/")
                && !original.endsWith(".jpg")
                && !original.endsWith(".jpeg")
                && !original.endsWith(".png")
                && !original.endsWith(".webp")
                && !original.endsWith(".gif")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only image files can be uploaded.");
        }
        try {
            return storeBytes(file.getBytes(), extensionFor(contentType, original));
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save image.");
        }
    }

    public String persistImageUrl(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String v = raw.trim();
        if (v.startsWith("data:image/")) {
            return storeDataUrl(v).get("url");
        }
        if (v.length() > 2000 && !v.startsWith("/uploads/")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Image is too large to save. Upload a smaller photo.");
        }
        return v;
    }

    public Map<String, String> storeDataUrl(String dataUrl) {
        int comma = dataUrl.indexOf(',');
        if (comma < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid image data.");
        }
        String meta = dataUrl.substring(0, comma).toLowerCase(Locale.ROOT);
        String ext = meta.contains("png") ? "png" : meta.contains("webp") ? "webp" : meta.contains("gif") ? "gif" : "jpg";
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(dataUrl.substring(comma + 1).replace("\n", "").replace("\r", ""));
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid image data.");
        }
        if (bytes.length > MAX_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Image is too large. Use a photo under 3 MB.");
        }
        return storeBytes(bytes, ext);
    }

    private Map<String, String> storeBytes(byte[] bytes, String ext) {
        try {
            Files.createDirectories(ROOT);
            String name = UUID.randomUUID().toString().replace("-", "") + "." + ext;
            Path dest = ROOT.resolve(name);
            Files.write(dest, bytes);
            return Map.of("url", "/uploads/" + name);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save image.");
        }
    }

    private static String extensionFor(String contentType, String filename) {
        if (contentType.contains("png") || filename.endsWith(".png")) return "png";
        if (contentType.contains("webp") || filename.endsWith(".webp")) return "webp";
        if (contentType.contains("gif") || filename.endsWith(".gif")) return "gif";
        return "jpg";
    }
}
