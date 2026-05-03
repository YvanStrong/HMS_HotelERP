package com.hms;

import com.hms.config.HmsMultitenancyProperties;
import com.hms.config.HmsPublicUrlProperties;
import com.hms.config.HmsStripeProperties;
import com.hms.config.JwtProperties;
import com.hms.config.SetupProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties({
    JwtProperties.class,
    SetupProperties.class,
    HmsMultitenancyProperties.class,
    HmsStripeProperties.class,
    HmsPublicUrlProperties.class
})
public class HmsApplication {

    public static void main(String[] args) {
        SpringApplication.run(HmsApplication.class, args);
    }
}
