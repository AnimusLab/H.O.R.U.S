#include "geospatial.hpp"

extern "C" double compute_haversine_ffi(double latitude_a, double longitude_a,
                                        double latitude_b, double longitude_b) {
    try {
        return calculate_distance_km(latitude_a, longitude_a, latitude_b, longitude_b);
    } catch (...) {
        return -1.0;
    }
}
