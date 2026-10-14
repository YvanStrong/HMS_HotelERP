package com.hms.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApi(ApiException ex, HttpServletRequest req) {
        if (ex instanceof SubscriptionAccessException subscription) {
            return ResponseEntity.status(subscription.getStatus())
                    .body(ApiErrorResponse.of(
                            subscription.getErrorCode(),
                            subscription.getReason(),
                            subscription.getMessage(),
                            req.getRequestURI()));
        }
        if (ex instanceof PosShiftException shiftEx) {
            return ResponseEntity.status(shiftEx.getStatus())
                    .body(ApiErrorResponse.of(
                            shiftEx.getErrorCode(),
                            shiftEx.getMessage(),
                            req.getRequestURI(),
                            shiftEx.getFields()));
        }
        return ResponseEntity.status(ex.getStatus())
                .body(ApiErrorResponse.of(ex.getErrorCode(), ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        Map<String, String> fields = new HashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fields.put(fe.getField(), fe.getDefaultMessage());
        }
        return ResponseEntity.badRequest()
                .body(ApiErrorResponse.of(
                        "VALIDATION_FAILED",
                        "Request payload validation failed",
                        req.getRequestURI(),
                        fields));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraint(
            DataIntegrityViolationException ex, HttpServletRequest req) {
        String raw = String.valueOf(ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage())
                .toLowerCase();
        String message = "Could not save this product. Please try again.";
        if (raw.contains("sale_number")) {
            message = "Could not assign an invoice number. Place the order again.";
        } else if (raw.contains("item_cd")) {
            message = "Could not assign a tax item code. Save the product again.";
        } else if (raw.contains("sku")) {
            message = "A product with this SKU already exists. Try again — a new SKU will be assigned.";
        } else if (raw.contains("product_code") || raw.contains("uk_depot_product_hotel_code")) {
            message = "A product with this code already exists. Change the name slightly and try again.";
        } else if (raw.contains("product_number")) {
            message = "Could not assign a product number. Try saving again.";
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiErrorResponse.of("CONFLICT", message, req.getRequestURI()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleTooBig(MaxUploadSizeExceededException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiErrorResponse.of(
                        "PAYLOAD_TOO_LARGE",
                        "Image is too large. Use a photo under 3 MB.",
                        req.getRequestURI()));
    }
}
