/**
 * @file   - visualizations.js
 * @author - Jason Pollman, Kris Tyte, Kevin VanEmmerick, & Charles Heiser
 * @date   - 5/5/2014
 *
 * This file contains the script that creates and updates the visualizations
 * using the d3.js library.
 */

// ------------------------------------------------------- GLOBAL VARS ------------------------------------------------------- //

// Holds the active ("checked") bar categories.
// An array that contains the names of each obesity link category
var categories = Array();
var originalCategories;

// Specify all transition delays here.
var timeout = 600;

// Specify all transistion easing here. See: https://github.com/mbostock/d3/wiki/Transitions#d3_ease
// for available string values...
var easing = "cubic";

// D3 Globals...
// So we can use these without passing variables around.
var format, data = Array(), vis, svg, barWidth, barHeight, barsG, x, y, xAxis, yAxis, axes;

// Sets the Visualization Margins
var margin = { top: 20, right: 20, bottom: 20, left: 20 };

// Grab current window size
var oldWindowSize = $(window).width();

var firstRunRan = false;

var visShowing = false;

// ----------------------------------------------------- END GLOBAL VARS ----------------------------------------------------- //



// Resize any visualization on window resize:
window.onresize = function(event) {

  // Get the new window size
  var newWindowSize = $(window).width();

  var width = $(window).width() - margin.left - margin.right;
  (width < 500) ? width = 500 : (width > 1600) ? width = 1600 : null;
 
  var changeInWidth =  Math.abs(oldWindowSize / newWindowSize);

  if(visShowing == true) {
    $("#landing-wrapper").css("left", (29 - $(window).outerWidth()));
  }

  // The width of the bar chart
  var absBarWidth = $("#vis-2").hiddenWidth();
  barWidth = absBarWidth - margin.left  - margin.right;

  // The height of the bar chart
  var absBarHeight = 500;
  barHeight = absBarHeight - margin.top  - margin.bottom;

  svg.attr("width", absBarWidth);
  svg.attr("height", absBarHeight);

  d3.selectAll("#vis-2 svg").remove();
  firstRun();

  oldWindowSize = newWindowSize;

}; // End of window.onresize() function


// <------------------------------------------------- BEGIN VISUALIZATION ---------------------------------------------------> //

String.prototype.capitalCase = function() {
  return this.replace(/\w\S*/g, function (s) { return s.charAt(0).toUpperCase() + s.substr(1).toLowerCase(); });
}


/**
 * This function is run when the body.onload() event is fired.
 * it sets up the visualization, and rendered the inital SVG state.
 */
function init() {

  // <------------------------------------------------ CSV PARSING & SETUP --------------------------------------------------> //

  d3.csv("data.csv", function (error, CSVData) {

    // Setup the global data variable in the format we need
    // That is: [{x, y, category}, {x, y, category}, ...]
    var n = 0;
    CSVData.forEach(function(e) {
      for(i in e) {
        if(i.toLowerCase() != "year") {
          data.push({id: n, x: parseFloat(e.year), y: parseFloat(e[i]), category: i});
          n++;
        }
      }
    });

    // The different data columns in the CSV
    categories = Object.keys(CSVData[0]);
    categories.sort();

    // Trim any whitespace
    categories.forEach(function(e) { e = e.trim(); });

    // For "non-filtering" purposes...
    originalCategories = categories;
    originalCategories.splice(originalCategories.indexOf("year"), 1);

    // Append elements for filtering by category
    var i = 0;
    categories.forEach(function(e) {
      if($("#vis-2-legend-item-" + i).length === 0 && e != "year") {
        $("#vis-2-legend").append("<li name=" + e.replace(/\W+/g, '-') + " class=\"legend-item " + e.replace(/\W+/g, '-') + "\"><div class=\"legend-indicator"  + " color-" + (i % originalCategories.length) + "\">On</div>" + e.capitalCase() + "</li>");
      }
      i++;
    });

    // Append an SVG Defs Element for Gradient & Shadow Definitons
    var defs = d3.select("defs");

    // <---------------------------------------------------- DROP SHADOWS ---------------------------------------------------> //

    var filter = defs.append("filter").attr("id", "drop-shadow")

    filter.append("feGaussianBlur")
        .attr("in", "SourceAlpha")
        .attr("stdDeviation", 2)
        .attr("result", "blur");

    filter.append("feOffset")
        .attr("in", "blur")
        .attr("dx", 0)
        .attr("dy", 4)
        .attr("result", "offsetBlur");

    var feMerge = filter.append("feMerge");

    feMerge.append("feMergeNode").attr("in", "offsetBlur")
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    var filter = defs.append("filter").attr("id", "pie-shadows")

    filter.append("feGaussianBlur")
        .attr("in", "SourceGraphic")
        .attr("stdDeviation", 8)
        .attr("result", "blur");

    filter.append("feColorMatrix")
      .attr("result", "matrixOut")
      .attr("in", "blur")
      .attr("type", "matrix")
      .attr("values", "0.2 0 0 0 0 0 0.2 0 0 0 0 0 0.2 0 0 0 0 0 1 0")

    filter.append("feOffset")
        .attr("in", "blur")
        .attr("dx", 0)
        .attr("dy", 4)
        .attr("result", "offsetBlur");

    filter.append("feComponentTransfer").append("feFuncA").attr("type", "linear").attr("slope", "0.5");



    var feMerge = filter.append("feMerge");

    feMerge.append("feMergeNode").attr("in", "offsetBlur")
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");


    // <------------------------------------------------------- FILTERS -----------------------------------------------------> //

    /*
       _____   ___ __ _  __
      |_  | |   | |_ |_)(_ 
      |  _|_|__ | |__| \__)

    */

    // Filter by category.
    // When a user clicks the "ON" and "OFF" category buttons...
    $(".legend-item").click(function() {

      // Grab the category name from the HTML name attribute:
      var name = $(this).attr("name").replace(/-/g, " ");

      // If it's in the categories array, remove it and therefore turn the
      // category "off". Otherwise add it and turn it "on".
      if(categories.exists(name)) {
        categories.splice(categories.indexOf(name), 1);
        // Update the ".legend-indicator" DIV to say the correct text.
        $(this).find(".legend-indicator").html("Off");
      }
      else {
        categories.push(name);
        // Update the ".legend-indicator" DIV to say the correct text.
        $(this).find(".legend-indicator").html("On");
      }

      // Now update the visualization to reflect the change in category selections:
      updateVis();

    }); // End of $(".legend-item").click() function

    // Sort the bars based on selected input.
    $("#sort-by, #direction").change(function() {
      sortBy($("#sort-by").val(), $("#direction").val());
    }); // End of sort filter

  }); // End of d3.csv() function

}  // End of init() function



/**
 * Called when the user clicks on the "See for yourself" button.
 * Since init() is called on DOM.ready(), the data exists when this is called.
 * However, we don't want to show animation or transition until the button is clicked
 * and the Vis revealed.
 */
function firstRun() {

  // The width of the bar chart
  var absBarWidth = $("#vis-2").hiddenWidth();
  barWidth = absBarWidth - margin.left  - margin.right;

  // The height of the bar chart
  var absBarHeight = 500;
  barHeight = absBarHeight - margin.top  - margin.bottom;

  // A format for the yAxis scale
  format = d3.format(".0%");

  // The X-Axis scale 
  x = d3.scale.ordinal().rangeRoundBands([0, barWidth], .1, 1);

  // The Y-Axis scale
  y = d3.scale.linear().range([barHeight, 0]);

  // The actual SVG Axes...
  xAxis = d3.svg.axis().scale(x).orient("bottom");

  yAxis = d3.svg.axis().scale(y).orient("left").tickFormat(format);

  // Append the bar chart SVG to the second visualization DIV:
  svg = d3.select("#vis-2").append("svg:svg")
    .attr("width", barWidth)
    .attr("height", absBarHeight);
  
  // Container for the axes.
  axes = svg.append("g")

  // Set the X-Axis domain as the data's 'year' column
  x.domain(data.map(function(d) { return d.x; }));

  // Set the Y-Axis domain from 0 to the max data point from all data
  // excluding the 'year' column.
  y.domain([0, d3.max(data, function(d) {
    var arr = Array();
    data.forEach(function(d) { arr.push(d.y)});
    return Math.max.apply(null, arr);
  })]);

  // Add a <g> element for the X-Axis
  axes.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + (barHeight + 5) + ")")
    .call(xAxis)

  // Add a <g> element for the Y-Axis
  axes.append("g")
    .attr("class", "y axis")
    .attr("transform", "translate(35, 0)")
    .call(yAxis)
    .append("text")
    .attr("class", "text")
    .attr("transform", "rotate(-90)")
    .attr("y", 6)
    .attr("dy", ".71em")
    .style("text-anchor", "end")
    .text("Percent").attr("class", "percent-text");

  $(".x.axis .tick text").attr("transform", "rotate(-35)")
    .attr("x", -10)
    .attr("y", 15)
  $(".y.axis .tick text").attr("y", $(".y.axis .tick text").attr("y") + 5);
  $(".y.axis .tick").first().remove();

  // Build the Pie Charts 
  // I.E. the first visualizations that will be
  // appended to the #vis-1 
  buildPie();

  // Build the sort by menu using the various categories
  buildSortBySelectMenu();

  // Add a <g> element to hold the actual bars of the bar chart
  barsG = svg.append("g").attr("class", "bars");

  // Append each category's bar...
  var add = barsG.selectAll("rect").data(data, function(d) { return d.id });
  add.enter()
  .append("rect")
    .attr("class", function(d, i) { return "bar " + d.category.replace(/\W+/g, '-') + " color-" + originalCategories.indexOf(d.category) })
    .attr("x", function(d) { return x(d.x) })
    .attr("y", barHeight)
    .attr("width", x.rangeBand() - 5)
    .attr("height", 0)

   // Specify transition update.
  add.transition().ease(easing).duration(timeout)
    .delay(timeout)
    .attr("y", function(d) { return y(d.y)})
    .attr("height", function(d) { return barHeight - y(d.y)});

  // Sort the bars based on DOM height.
  sortBars();

  // Add the modal popup menus
  addModalPopup();

} // End firstRun function()



/**
 * Sorts the categories array and appends options to the select#sort-by element.
 */
function buildSortBySelectMenu() {
  $("#sort-by").children().remove();
  $("#sort-by").append("<option value=\"default\">Year</option>");
  categories.sort();
  categories.forEach(function(i) {
    if(i.toLowerCase() != "year") $("#sort-by").append("<option value=\"" + i + "\">" + i.capitalCase() + "</option>");
  });

} // End buildSortBySelectMenu() function



/**
 * Updates the visualization with a animated transitions based on the user selected
 * filters.
 *
 * Note, unline many visualizations, in this one SVGs are not added and removed on
 * updates, the data bar height is just set to 0 and reset to it's actual height on
 * filtering. This was done so that once the bars were sorted in the correct height order
 * that: (1) the overhead of resorting could be avoided and (2) there was a visual glitch
 * on the animation transition and jQuery element sorting — a screen "flicker."
 */
function updateVis() {

  buildSortBySelectMenu();

  // An array to hold the new data values after being filtered.
  var newData = Array();

  data.forEach(function(e) {

    // If the data category isn't in the categories array, this item is "OFF" and
    // shouldn't be added to the newData array, otherwise add it.
    if(categories.exists(e.category)) { newData.push(e); }

  }); // End data.forEach()

  // If all categories are "off",
  // then show "enable category" message.
  if(categories.length == 0) {
    svg.insert("text").text("Enable some data points by clicking a category above to turn it on.").style("text-anchor", "middle")
      .attr("x", barWidth/2)
      .attr("y", barHeight/2)
      .attr("class", "no-bars")
  }
  else {
    $(".no-bars").remove();
  }

  // Adjust Y-Axis to meet Max of the data shown only.
  y.domain([0, d3.max(data, function(d) {
    var arr = Array();
    newData.forEach(function(d) { arr.push(d.y)});
    return Math.max.apply(null, arr);
  })]);
  
  // A D3 SVG Object  
  var add = barsG.selectAll("rect").data(newData, function(d) { return d.id });

  // Specify what to do when the SVG Bar item is no longer in the newData array.
  add.exit().transition().ease(easing).duration(timeout)
    .attr("y", barHeight)
    .attr("height", 0);

  // Specify what to do when data is added to the newData array.
  // Note, we set the height here to 0 and the transition update will
  // animate it to the correct y-value size.
  add.enter().append("rect")
    .attr("y", function(d) { return y(d.y)})
    .attr("height", 0);

  // Specify transition update for data entries:
  add.transition().ease(easing).duration(timeout)
    .attr("y", function(d) { return y(d.y)})
    .attr("height", function(d) { return barHeight - y(d.y)});


  // Remove old Y-Axis and add a new one
  // Add a <g> element for the Y-Axis and the Y-Axis
  d3.select(".y.axis").remove();
  axes.append("g")
    .attr("class", "y axis")
    .attr("transform", "translate(35, 0)")
    .call(yAxis)
    .append("text")
    .attr("class", "text")
    .attr("transform", "rotate(-90)")
    .attr("y", 6)
    .attr("dy", ".71em")
    .style("text-anchor", "end")
    .text("Percent").attr("class", "percent-text");

  $(".y.axis .tick text").attr("y", $(".y.axis .tick text").attr("y") + 5);
  $(".y.axis .tick").first().remove();

  // Add the modal popup menus
  addModalPopup();

} // End of updateVis function


/**
 * Sorts the bars based on the HTML attribute height.
 * Moves bars with a lower height below elements with a larger height.
 * Applied to all $(".bar") elements.
 */
function sortBars() {
  // Sort the DOM Elements based on the HTML Attribute "height" so the largest bars
  // are in the background, and the shortest in the front.
  setTimeout(function() {
    $(".bars").find(".bar").sort(function(a, b) {

    // Element a's height...
    a = parseFloat($(a).attr("height"));

    // Element b's height...
    b = parseFloat($(b).attr("height"));

    // -1 - Shift backward, 1 - Shift forward, 0 - Don't move.
    return (a > b) ? -1 : (a < b) ? 1 : 0;

  }).appendTo($(".bars")); // End element sort.

  }, timeout + 200); // 2/10 of a second... to fast for a human to notice the time offset.
  
} // End sortBars() function


/**
 * Sorts the X-Axis by the category selected by the select#sort-by element
 */
function sortBy(category, direction) {

  // Remove any context menus visible
  $("#popup-menu").remove();

  // Input only the data from the selected category
  // into an array and map the X-Axis to it.
  var dataByCategory = Array();
  data.forEach(function (e) {
    if(e.category == category) {
      dataByCategory.push(e);
    }
  });

  // Sort the data array by value and direction.
  dataByCategory.sort(function(a, b) {
    return (direction == "asc") ? (a.y > b.y) ? 1 : (a.y < b.y) ? -1 : 0 : (a.y > b.y) ? -1 : (a.y < b.y) ? 1 : 0;
  });

  var x0  = (category != "default") ?
    x.domain(dataByCategory.map(function(d) { return d.x; })).copy() :
    (direction == "asc") ?
      x.domain(data.map(function(d) { return d.x; })).copy() :
      x.domain(data.reverse().map(function(d) { return d.x; })).copy();

  var transition = svg.transition().duration(750),
      delay = function(d, i) { return i * 10; };

  transition.selectAll(".bar")
    .delay(delay)
    .attr("x", function(d) { return x0(d.x); });

  transition.select(".x.axis")
    .call(xAxis)
    .selectAll("g")
    .delay(delay);

  $(".x.axis .tick text").attr("x", -10).attr("y", 15);

} // End of sortByCategory() function



/**
 * Builds and appends the pie chart visualizations...
 */
function buildPie() {

  d3.selectAll("#vis-1 *").remove();

  var width  = 200,
      height = width,
      radius = Math.min(width, height) / 2;

  // Call the function that determines the percentage each category is correlated to
  // obesity.
  var pieArray = analyzeCorrelation();

  var i = 0;
  pieArray.forEach(function (e) {

    if(i % parseInt(originalCategories.length) == 0) {
      $("#vis-1").append("<br />");
    }
    var pie = d3.layout.pie().sort(null);

    var arc = d3.svg.arc()
      .innerRadius(radius - width * .20)
      .outerRadius(radius - 20);

    var svg = d3.select("#vis-1").append("svg:svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("class", "pie-slices")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    var path = svg.selectAll("path")
      .data(pie(e.values))
      .enter().append("path")
      .attr("class", function(d, i) { return i == 1 ? "pie pie-" + e.category.replace(/\W+/g, '-') + " color-" + originalCategories.indexOf(e.category) : "pie pie-gray" })
      .attr("d", arc);

    // Will colorize the text by adding a class based on the value of the pie slice.
    var c;
    var x = e.values[1] * 100;
    x > 80 ? c = 100 : x > 60 ? c = 80 : x > 40 ? c = 60 : x > 20 ? c = 40 : c = 20;   

    svg.append("text")
      .attr("dy", ".35em")
      .style("text-anchor", "middle")
      .attr("class", "pie-percent " + "c" + c)
      .attr("transform","translate(0, -10)")
      .text(function(d) { return format(e.values[1])});

    svg.append("text")
      .attr("dy", ".35em")
      .style("text-anchor", "middle")
      .attr("class", "pie-label")
      .attr("transform","translate(0, 18)")
      .text(function(d) { return e.category.capitalCase() });

    i++;
  });

} // End buildPie() function


/**
 * Determines how each category is linked to obesity and build and returns
 * the data set for the pie charts.
 *
 * Algorithm: Calculates the area between the obesity curve and the respective category curve.
 * If the area = 0, the curve is the same, and there is a 100% correlation between obesity
 * and the category.
 *
 * Next, the area of the obesity curve is computed. If the area of the curve for the respective
 * category == the area of the obesity curve, then they are likely inverses and a -100% correlation
 * exists.
 *
 * Other values lie inbetween.
 */
function analyzeCorrelation() {

  var dataArray = Object();
  var analyzeData = data;

  originalCategories.forEach(function (category) {

    if(category != "year") {
      dataArray[category] = Array();

      analyzeData.forEach(function(datum) {

        if(datum.category == category) {
          dataArray[category].push(datum.y)
        }

      }); // End analyzeData.forEach()

    } // End if block

  }); // End originalCategories.forEach()

  // Compute area of Obesity Curve
  var obesityCurveArea = 0;
  var obesityCurve = Array();
  dataArray.obesity.forEach(function(e) {
    obesityCurveArea += e;
    obesityCurve.push(e);

  }); // End dataArray.obesity.forEach()


  var differenceArray = Array();
  var returnArray = Array();
  for(category in dataArray) {
    differenceArray[category] = 0;
    for(i in dataArray[category]) {
      if(!isNaN(i)) differenceArray[category] += Math.abs(dataArray[category][i] - obesityCurve[i]);
    } // End inner for loop

    // (Area of Obesity Curve - Difference of Area Between Obesity & Category) / Area of Obesity Curve 
    differenceArray[category] = (obesityCurveArea - differenceArray[category]) / obesityCurveArea < 0 ? 0 : (obesityCurveArea - differenceArray[category]) / obesityCurveArea;

    returnArray.push({ category: category, values: [1-differenceArray[category], differenceArray[category]]});
  } // End for loop

  return returnArray;

} // End analyzeCorrelation() function


/**
 * Create the DIV and Children elements for each bars's modal "hover-over" menu.
 */
function addModalPopup() {

  /* Popup Modal */

  // Modal Popup on Mouseover
  svg.selectAll(".bar").on("mouseover", function(d) {

    // Get the cursor's current position
    var position = d3.mouse(this.parentNode.parentNode.parentNode.parentNode.parentNode);

    // If a context menu is already displayed, remove it.
    d3.selectAll("#popup-menu").transition().duration(500).style('opacity', 0).remove();

    menu = d3.select("body").append('div')
      .attr("id", "popup-menu")
      .style('position', 'absolute')

      // Move the menu to the cursor location... but not exactly,
      // because right on top is somewhat annoying... so + 10px.
      .style('left' , position[0] + 20 + "px")
      .style('opacity', 0)
      .style('display', 'block');

      // Add the node's title.
      // If it's a movie, add the title, if it's a popularity circle, then add d.desc, else add d.name

      var attrContainer = menu.append("div")
      attrContainer.attr("id", "popup-items");

      attrContainer.append("div").attr("class", "close").html("<span>X</span>");

      attrContainer.append("h3").attr("class", "popup-year").html("<span>" + d.x + "</span>");

      // Add a simple <hr> element
      attrContainer.append("hr");

      // Append each additional attribute for each category
      var i = 0;
      data.forEach(function (d2) {
        if(d2.x == d.x && d2.category.toLowerCase() != "obesity") {
          attrContainer.append("div")
            .attr("class", "popup-item " + d2.category.replace(/\W+/g, '-') + ((i % 2 == 0) ? " odd" : " even"))
            .html("<span class=\"category\">" + d2.category.capitalCase() + ": </span><span class=\"value\">" + format(d2.y) + "</span>");
        }

        i++;

      }); // End data.forEach()

      i = 0;
      data.forEach(function (d2) {
        if(d2.category.toLowerCase() == "obesity" && d2.x == d.x) {
          attrContainer.append("div")
            .attr("class", "popup-item obesity")
            .html("<span class=\"value\">" + format(d2.y) + "</span><span class=\"text\">Of U.S. Citizens Obese</span>")
        }

        i++;

      }); // End data.forEach()

      // Move popup menu to be higher than cursor to meet tick:
      menu.style('top'  , position[1] - $("#popup-menu").height() + "px");

      // Fade In...
      menu.transition().duration(1000).delay(200).style("opacity", 100);

  })
  .on("mouseout", function(d) {

    // Close the window if the "X" is clicked
    $("#popup-items .close").click(function() {
      d3.selectAll("#popup-menu").transition().duration(500).style('opacity', 0).remove();
    });

    if (!$('#popup-menu').is(':hover')) {
      d3.selectAll("#popup-menu").transition().duration(500).style('opacity', 0).remove();
    }
  }); // End of .on() method

  // Close the popup menu when a user clicks the "X"

} // End of addModalPopup() function