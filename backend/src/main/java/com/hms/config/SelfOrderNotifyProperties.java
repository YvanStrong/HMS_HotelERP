package com.hms.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "hms.self-order.notify")
public class SelfOrderNotifyProperties {

    /** Base64url VAPID public key (no padding). */
    private String vapidPublicKey;

    /** Base64url VAPID private key (no padding). */
    private String vapidPrivateKey;

    /** Contact for push services, e.g. mailto:ops@hotel.com */
    private String vapidSubject = "mailto:hms@localhost";

    private String twilioAccountSid;
    private String twilioAuthToken;
    private String twilioFromNumber;

    public String getVapidPublicKey() {
        return vapidPublicKey;
    }

    public void setVapidPublicKey(String vapidPublicKey) {
        this.vapidPublicKey = vapidPublicKey;
    }

    public String getVapidPrivateKey() {
        return vapidPrivateKey;
    }

    public void setVapidPrivateKey(String vapidPrivateKey) {
        this.vapidPrivateKey = vapidPrivateKey;
    }

    public String getVapidSubject() {
        return vapidSubject;
    }

    public void setVapidSubject(String vapidSubject) {
        this.vapidSubject = vapidSubject;
    }

    public String getTwilioAccountSid() {
        return twilioAccountSid;
    }

    public void setTwilioAccountSid(String twilioAccountSid) {
        this.twilioAccountSid = twilioAccountSid;
    }

    public String getTwilioAuthToken() {
        return twilioAuthToken;
    }

    public void setTwilioAuthToken(String twilioAuthToken) {
        this.twilioAuthToken = twilioAuthToken;
    }

    public String getTwilioFromNumber() {
        return twilioFromNumber;
    }

    public void setTwilioFromNumber(String twilioFromNumber) {
        this.twilioFromNumber = twilioFromNumber;
    }

    public boolean hasVapidKeys() {
        return vapidPublicKey != null
                && !vapidPublicKey.isBlank()
                && vapidPrivateKey != null
                && !vapidPrivateKey.isBlank();
    }

    public boolean hasTwilio() {
        return twilioAccountSid != null
                && !twilioAccountSid.isBlank()
                && twilioAuthToken != null
                && !twilioAuthToken.isBlank()
                && twilioFromNumber != null
                && !twilioFromNumber.isBlank();
    }
}
