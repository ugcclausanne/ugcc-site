module.exports = function(eleventyConfig) {
  // Allow using `page` in front matter (project uses it for routing)
  eleventyConfig.setFreezeReservedData(false);
  // Copy static assets
  eleventyConfig.addPassthroughCopy("assets/css");
  eleventyConfig.addPassthroughCopy("assets/js");
  eleventyConfig.addPassthroughCopy("assets/images");

  // Directory structure
  return {
    dir: {
      input: "templates",
      // Paths below are relative to `input`
      includes: ".",
      layouts: ".",
      output: "_site"
    },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    passthroughFileCopy: true
  };
};
