#include "geospatial.hpp"

#include <cassert>
#include <cmath>

int main() {
    const double paris_to_tehran = calculate_distance_km(48.8566, 2.3522, 35.6892, 51.3890);
    assert(std::abs(paris_to_tehran - 4208.4) < 1.0);
    assert(calculate_distance_km(0.0, 0.0, 0.0, 0.0) == 0.0);

    bool rejected = false;
    try {
        (void)calculate_distance_km(91.0, 0.0, 0.0, 0.0);
    } catch (const std::invalid_argument&) {
        rejected = true;
    }
    assert(rejected);
}
