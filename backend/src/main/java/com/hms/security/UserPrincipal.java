package com.hms.security;

import com.hms.domain.Role;
import com.hms.entity.AppUser;
import java.security.Principal;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

@Getter
public class UserPrincipal implements UserDetails, Principal {

    private final UUID id;
    private final String username;
    private final String passwordHash;
    private final Role role;
    private final UUID hotelId;
    private final Collection<? extends GrantedAuthority> authorities;

    public UserPrincipal(UUID id, String username, String passwordHash, Role role, UUID hotelId) {
        this.id = id;
        this.username = username;
        this.passwordHash = passwordHash;
        this.role = role;
        this.hotelId = hotelId;
        this.authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    public static UserPrincipal fromEntity(AppUser user) {
        UUID hid = user.getHotel() != null ? user.getHotel().getId() : null;
        return new UserPrincipal(user.getId(), user.getUsername(), user.getPasswordHash(), user.getRole(), hid);
    }

    public static UserPrincipal authenticated(UUID id, String username, Role role, UUID hotelId) {
        return new UserPrincipal(id, username, null, role, hotelId);
    }

    @Override
    public String getName() {
        return username;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return passwordHash == null ? "" : passwordHash;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
