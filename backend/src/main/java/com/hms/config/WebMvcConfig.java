package com.hms.config;

import com.hms.web.TenantContextInterceptor;
import com.hms.security.ModuleEntitlementInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final TenantContextInterceptor tenantContextInterceptor;
    private final ModuleEntitlementInterceptor moduleEntitlementInterceptor;

    public WebMvcConfig(
            TenantContextInterceptor tenantContextInterceptor,
            ModuleEntitlementInterceptor moduleEntitlementInterceptor) {
        this.tenantContextInterceptor = tenantContextInterceptor;
        this.moduleEntitlementInterceptor = moduleEntitlementInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(tenantContextInterceptor).addPathPatterns("/api/**");
        registry.addInterceptor(moduleEntitlementInterceptor).addPathPatterns("/api/v1/hotels/**");
    }
}
