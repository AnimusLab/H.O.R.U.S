fn main() {
    println!("cargo:rerun-if-changed=../engine-cpp/geospatial.hpp");
    println!("cargo:rerun-if-changed=../engine-cpp/horus_geo.cpp");
    cc::Build::new()
        .cpp(true)
        .file("../engine-cpp/horus_geo.cpp")
        .include("../engine-cpp")
        .flag_if_supported("-std=c++17")
        .compile("horus_geo");
}
