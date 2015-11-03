/**
 * Main JS file for Boo behaviours
 */

/*globals jQuery, document */
(function ($) {
    "use strict";

    $(document).ready(function(){

        // On the home page, move the blog icon inside the header 
        // for better relative/absolute positioning.

        //$("#blog-logo").prependTo("#site-head-content");

        if ($('.post-summary').length) {
            var $parent = [$('<ul></ul>')];
            var last_depth = 2;
            var $el = 0;

            $('.post-content').find('h2, h3, h4, h5, h6').each(function () {
                var depth;
                depth = +this.nodeName[1];
                if (depth > last_depth) {
                    $parent[depth - 2] = $('<ul>').appendTo($el);
                }
                var name = encodeURIComponent($(this).text());
                $(this).before($('<a>').attr('name', name));
                var $link = $('<a>').attr('href', '#' + name).text($(this).text());
                $el = $('<li>').append($link);
                $parent[depth - 2].append($el);
                return last_depth = depth;
            });

            $(".post-summary").append($parent[0]);
        }
    });

}(jQuery));
