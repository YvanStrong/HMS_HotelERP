package com.hms.config;

import com.hms.web.TenantContextInterceptor;
import com.hms.security.ActivityAuditInterceptor;
import com.hms.security.ModuleEntitlementInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final TenantContextInterceptor tenantContextInterceptor;
    private final ModuleEntitlementInterceptor moduleEntitlementInterceptor;
    private final ActivityAuditInterceptor activityAuditInterceptor;

    public WebMvcConfig(
            TenantContextInterceptor tenantContextInterceptor,
            ModuleEntitlementInterceptor moduleEntitlementInterceptor,
            ActivityAuditInterceptor activityAuditInterceptor) {
        this.tenantContextInterceptor = tenantContextInterceptor;
        this.moduleEntitlementInterceptor = moduleEntitlementInterceptor;
        this.activityAuditInterceptor = activityAuditInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(tenantContextInterceptor).addPathPatterns("/api/**");
        registry.addInterceptor(moduleEntitlementInterceptor).addPathPatterns("/api/v1/hotels/**");
        registry.addInterceptor(activityAuditInterceptor).addPathPatterns("/api/v1/hotels/**");
    }
}
