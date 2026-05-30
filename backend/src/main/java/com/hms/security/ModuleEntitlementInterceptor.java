package com.hms.security;

import com.hms.domain.Role;
import com.hms.service.HotelModuleEntitlementService;
import com.hms.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class ModuleEntitlementInterceptor implements HandlerInterceptor {

    private final TenantAccessService tenantAccessService;
    private final HotelModuleEntitlementService entitlementService;

    public ModuleEntitlementInterceptor(
            TenantAccessService tenantAccessService, HotelModuleEntitlementService entitlementService) {
        this.tenantAccessService = tenantAccessService;
        this.entitlementService = entitlementService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod method)) {
            return true;
        }
        CheckModuleEntitlement annotation = method.getMethodAnnotation(CheckModuleEntitlement.class);
        if (annotation == null) {
            annotation = method.getBeanType().getAnnotation(CheckModuleEntitlement.class);
        }
        if (annotation == null) {
            return true;
        }
        UserPrincipal user = tenantAccessService.currentUser();
        if (user.getRole() == Role.SUPER_ADMIN) {
            return true;
        }
        UUID hotelId = resolveHotelId(request);
        if (hotelId == null || entitlementService.hasModule(hotelId, annotation.value())) {
            return true;
        }
        throw new ApiException(
                HttpStatus.FORBIDDEN,
                "MODULE_NOT_ENABLED",
                "This feature is not enabled for your hotel.");
    }

    @SuppressWarnings("unchecked")
    private UUID resolveHotelId(HttpServletRequest request) {
        Object raw = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (!(raw instanceof Map<?, ?> vars) || vars.get("hotelId") == null) {
            return null;
        }
        return UUID.fromString(String.valueOf(vars.get("hotelId")));
    }
}
