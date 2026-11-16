#pragma once

#include <algorithm>
#include <cmath>
#include <stdexcept>

inline double calculate_distance_km(double latitude_a, double longitude_a,
                                    double latitude_b, double longitude_b) {
    if (std::abs(latitude_a) > 90.0 || std::abs(latitude_b) > 90.0 ||
        std::abs(longitude_a) > 180.0 || std::abs(longitude_b) > 180.0) {
        throw std::invalid_argument("coordinates are outside valid ranges");
    }

    constexpr double pi = 3.14159265358979323846;
    constexpr double earth_radius_km = 6371.0;
    const double radians = pi / 180.0;
    const double d_latitude = (latitude_b - latitude_a) * radians;
    const double d_longitude = (longitude_b - longitude_a) * radians;
    const double latitude_a_radians = latitude_a * radians;
    const double latitude_b_radians = latitude_b * radians;
    const double haversine = std::sin(d_latitude / 2.0) * std::sin(d_latitude / 2.0) +
        std::cos(latitude_a_radians) * std::cos(latitude_b_radians) *
        std::sin(d_longitude / 2.0) * std::sin(d_longitude / 2.0);

    return earth_radius_km * 2.0 * std::asin(std::sqrt(std::min(1.0, haversine)));
}
