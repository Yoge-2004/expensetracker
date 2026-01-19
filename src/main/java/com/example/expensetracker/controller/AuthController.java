package com.example.expensetracker.controller;

import com.example.expensetracker.dto.*;
import com.example.expensetracker.mapper.UserMapper;
import com.example.expensetracker.model.User;
import com.example.expensetracker.security.JwtService;
import com.example.expensetracker.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserService userService;

    public AuthController(AuthenticationManager authenticationManager,
                          JwtService jwtService,
                          UserService userService) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userService = userService;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        String token = jwtService.generateToken(authentication.getName());

        User user = userService.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // ✅ Return Name in response
        return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getName()));
    }

    @PostMapping("/register")
    public ResponseEntity<UserDto> register(@Valid @RequestBody RegisterRequest request) {
        User user = new User();
        user.setName(request.getName()); // ✅ Save Name
        user.setEmail(request.getEmail());
        user.setPassword(request.getPassword());

        User registeredUser = userService.registerUser(user);

        return new ResponseEntity<>(UserMapper.toDto(registeredUser), HttpStatus.CREATED);
    }


    @PutMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@RequestBody ResetPasswordRequest request) { // ✅ Use DTO
        if (request.getEmail() == null || request.getNewPassword() == null) {
            return ResponseEntity.badRequest().build();
        }
        userService.updatePassword(request.getEmail(), request.getNewPassword());
        return ResponseEntity.ok().build();
    }
}