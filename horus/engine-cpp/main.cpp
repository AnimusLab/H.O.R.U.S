#include "geospatial.hpp"

#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

struct TargetNode {
    std::string id;
    double latitude;
    double longitude;
    int threat_level;
};

int main() {
    const std::vector<TargetNode> nodes = {
        {"Paris_Unrest", 48.8566, 2.3522, 2},
        {"Tehran_Conflict", 35.6892, 51.3890, 4},
    };

    std::cout << "H.O.R.U.S. geospatial demo engine initialized\n";
    for (const auto& node : nodes) {
        std::cout << "[NODE] " << node.id << " | threat=" << node.threat_level
                  << " | coordinates=" << std::fixed << std::setprecision(4)
                  << node.latitude << "," << node.longitude << '\n';
    }
    std::cout << "[DISTANCE] Paris -> Tehran: "
              << std::fixed << std::setprecision(1)
              << calculate_distance_km(nodes[0].latitude, nodes[0].longitude,
                                       nodes[1].latitude, nodes[1].longitude)
              << " km\n";
}
