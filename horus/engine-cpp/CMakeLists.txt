cmake_minimum_required(VERSION 3.15)
project(horus_engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(horus_engine main.cpp)

include(CTest)
if(BUILD_TESTING)
    add_executable(horus_engine_tests tests.cpp)
    add_test(NAME horus_engine_tests COMMAND horus_engine_tests)
endif()
