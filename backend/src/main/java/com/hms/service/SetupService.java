package com.hms.service;

import com.hms.api.dto.ApiDtos;
import com.hms.config.SetupProperties;
import com.hms.domain.CleanlinessStatus;
import com.hms.domain.Role;
import com.hms.domain.RoomStatus;
import com.hms.entity.AppUser;
import com.hms.entity.Hotel;
import com.hms.entity.Room;
import com.hms.entity.RoomType;
import com.hms.repository.AppUserRepository;
import com.hms.repository.HotelRepository;
import com.hms.repository.RoomRepository;
import com.hms.repository.RoomTypeRepository;
import com.hms.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SetupService {

    private final SetupProperties setupProperties;
    private final HotelRepository hotelRepository;
    private final HotelProvisioningService hotelProvisioningService;
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final RoomTypeService roomTypeService;
    private final RoomTypeRepository roomTypeRepository;
    private final RoomRepository roomRepository;

    public SetupService(
            SetupProperties setupProperties,
            HotelRepository hotelRepository,
            HotelProvisioningService hotelProvisioningService,
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder,
            RoomTypeService roomTypeService,
            RoomTypeRepository roomTypeRepository,
            RoomRepository roomRepository) {
        this.setupProperties = setupProperties;
        this.hotelRepository = hotelRepository;
        this.hotelProvisioningService = hotelProvisioningService;
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.roomTypeService = roomTypeService;
        this.roomTypeRepository = roomTypeRepository;
        this.roomRepository = roomRepository;
    }

    @Transactional
    public ApiDtos.SetupInitializeResponse initialize(String setupTokenHeader, ApiDtos.SetupInitializeRequest req) {
        if (setupProperties.getToken() == null || setupProperties.getToken().isBlank()) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Server is not configured for setup: set property hms.setup.token (or SETUP_TOKEN)");
        }
        if (setupTokenHeader == null || setupTokenHeader.isBlank()) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Missing or empty setup token. Send a non-blank X-Setup-Token header and/or setupToken query parameter "
                            + "matching SETUP_TOKEN / hms.setup.token. In Postman: remove empty `setupToken` from the active "
                            + "environment (it overrides the collection), or set it to the same value as the server.");
        }
        if (!setupProperties.getToken().equals(setupTokenHeader.trim())) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "X-Setup-Token does not match the server token. Fix Postman `setupToken` or server SETUP_TOKEN / hms.setup.token so they are identical.");
        }
        if (hotelRepository.count() > 0) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Setup has already been completed");
        }

        Hotel hotel = hotelProvisioningService.createHotel(req.hotel());
        saveUser(req.superAdmin(), Role.SUPER_ADMIN, null);

        if (req.hotelAdmin() != null) {
            saveUser(req.hotelAdmin(), Role.HOTEL_ADMIN, hotel);
        }

        int rtCount = 0;
        if (req.roomTypes() != null) {
            for (ApiDtos.RoomTypeCreateInput rt : req.roomTypes()) {
                roomTypeService.createForHotel(hotel, rt);
                rtCount++;
            }
        }

        int roomCount = 0;
        if (req.rooms() != null) {
            for (ApiDtos.BootstrapRoomInput br : req.rooms()) {
                createRoomDuringSetup(hotel, br);
                roomCount++;
            }
        }

        return new ApiDtos.SetupInitializeResponse(
                hotel.getId(),
                "Platform initialized. Sign in as super admin, then use platform/hotel APIs for additional tenants.",
                rtCount,
                roomCount);
    }

    private void saveUser(ApiDtos.BootstrapUserInput creds, Role role, Hotel hotel) {
        String username = creds.username().trim();
        if (appUserRepository.findByUsername(username).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "USERNAME_TAKEN", "Username already exists: " + username);
        }
        String email = creds.email() == null || creds.email().isBlank() ? null : creds.email().trim();
        if (email != null && appUserRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "Email already exists: " + email);
        }
        AppUser u = new AppUser();
        u.setUsername(username);
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(creds.password()));
        u.setRole(role);
        u.setHotel(hotel);
        appUserRepository.save(u);
    }

    private void createRoomDuringSetup(Hotel hotel, ApiDtos.BootstrapRoomInput br) {
        if (roomRepository.existsByHotel_IdAndRoomNumberIgnoreCase(hotel.getId(), br.roomNumber())) {
            throw new ApiException(HttpStatus.CONFLICT, "Room number already exists: " + br.roomNumber());
        }
        RoomType rt = roomTypeRepository
                .findByHotel_IdAndCodeIgnoreCase(hotel.getId(), br.roomTypeCode().trim())
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST, "Unknown room type code for this hotel: " + br.roomTypeCode()));
        Room room = new Room();
        room.setHotel(hotel);
        room.setRoomType(rt);
        room.setRoomNumber(br.roomNumber().trim());
        room.setFloor(br.floor());
        room.setBuilding(br.building());
        RoomStatus initial = RoomStatus.VACANT_CLEAN;
        if (br.initialStatus() != null && !br.initialStatus().isBlank()) {
            initial = RoomStatus.valueOf(br.initialStatus().trim().toUpperCase());
        }
        room.setStatus(initial);
        room.setCleanliness(CleanlinessStatus.INSPECTED);
        room.setOutOfOrder(initial == RoomStatus.OUT_OF_ORDER);
        roomRepository.save(room);
    }
}
