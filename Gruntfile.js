module.exports = function (grunt) {
    "use strict";

    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-jscs");

    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        jshint: {
            options: {
                jshintrc: ".jshintrc"
            },
            files: {
                src: ["Gruntfile.js", "*.js"]
            }

        },
        jscs: {
            src: ["Gruntfile.js", "*.js"],
            options: {
                config: ".jscsrc"
            }
        }
    });

    grunt.registerTask("default", [
        "jshint",
        "jscs"
    ]);
    grunt.registerTask("quick", [
        "jshint",
        "jscs"
    ]);
};
