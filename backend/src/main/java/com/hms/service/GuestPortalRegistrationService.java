package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.domain.Role;
import com.hms.entity.AppUser;
import com.hms.entity.Guest;
import com.hms.entity.Hotel;
import com.hms.repository.AppUserRepository;
import com.hms.repository.GuestRepository;
import com.hms.repository.HotelRepository;
import com.hms.config.JwtProperties;
import com.hms.security.JwtService;
import com.hms.security.RolePermissions;
import com.hms.security.UserPrincipal;
import com.hms.web.ApiException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GuestPortalRegistrationService {

    private final HotelRepository hotelRepository;
    private final AppUserRepository appUserRepository;
    private final GuestRepository guestRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;

    public GuestPortalRegistrationService(
            HotelRepository hotelRepository,
            AppUserRepository appUserRepository,
            GuestRepository guestRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            JwtProperties jwtProperties) {
        this.hotelRepository = hotelRepository;
        this.appUserRepository = appUserRepository;
        this.guestRepository = guestRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
    }

    @Transactional
    public ApiDtos.LoginResponse register(ApiDtos.RegisterGuestRequest req) {
        UUID hotelId = req.hotelId();
        Hotel hotel = hotelRepository
                .findById(hotelId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Hotel not found"));
        String email = req.email().trim().toLowerCase();
        if (appUserRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "An account already exists for this email");
        }
        if (appUserRepository.findByUsername(email).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "Username already taken");
        }

        Optional<Guest> orphan = guestRepository.findByHotel_IdAndEmailIgnoreCase(hotelId, email);
        if (orphan.isPresent() && orphan.get().getPortalAccount() != null) {
            throw new ApiException(
                    HttpStatus.CONFLICT, "Guest profile at this property is already linked to a portal account");
        }

        AppUser u = new AppUser();
        u.setUsername(email);
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        u.setRole(Role.GUEST);
        u.setHotel(hotel);
        u = appUserRepository.save(u);

        if (orphan.isPresent()) {
            Guest g = orphan.get();
            g.setPortalAccount(u);
            g.setFirstName(req.firstName().trim());
            g.setLastName(req.lastName().trim());
            g.setFullName(req.firstName().trim() + " " + req.lastName().trim());
            if (g.getNationalId() == null || g.getNationalId().isBlank()) {
                g.setNationalId("PORTAL-" + u.getId().toString().replace("-", "").substring(0, 12));
            }
            if (g.getDateOfBirth() == null) {
                g.setDateOfBirth(java.time.LocalDate.of(1990, 1, 1));
            }
            if (req.phone() != null && !req.phone().isBlank()) {
                g.setPhone(req.phone().trim());
            }
            GuestProfileDefaults.ensureRequiredForPersistence(g);
            guestRepository.save(g);
        } else {
            Guest g = new Guest();
            g.setHotel(hotel);
            g.setFirstName(req.firstName().trim());
            g.setLastName(req.lastName().trim());
            g.setFullName(req.firstName().trim() + " " + req.lastName().trim());
            g.setNationalId("PORTAL-" + u.getId().toString().replace("-", "").substring(0, 12));
            g.setDateOfBirth(java.time.LocalDate.of(1990, 1, 1));
            g.setEmail(email);
            g.setPhone(req.phone() != null && !req.phone().isBlank() ? req.phone().trim() : null);
            g.setPortalAccount(u);
            GuestProfileDefaults.ensureRequiredForPersistence(g);
            guestRepository.save(g);
        }

        AppUser loaded =
                appUserRepository.findById(u.getId()).orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "User missing"));
        UserPrincipal principal = UserPrincipal.fromEntity(loaded);
        return new ApiDtos.LoginResponse(
                jwtService.generateToken(principal),
                jwtService.generateRefreshToken(principal),
                jwtProperties.getExpirationMs() / 1000,
                "Bearer",
                new ApiDtos.AuthUserInfo(
                        loaded.getId(),
                        loaded.getEmail(),
                        loaded.getUsername(),
                        principal.getRole().name(),
                        principal.getHotelId(),
                        RolePermissions.forRole(principal.getRole())));
    }
}
