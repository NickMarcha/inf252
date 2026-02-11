# Exercise Description

In this last small programming exercise, you will explore the practical considerations and issues for making visualizations interactive. To do so, you will build an interactive visualization that facilitates understanding of a question for a dataset of your choice. As you may have surmised from the course content so far and soon in the Visual Analytics module, interaction can be a really useful means to guide the user through data and make complex information digestible.

You can implement this exercise in the libraries we've seen in lab: [Plot](https://observablehq.com/plot/) or [D3](https://d3js.org/). You can also try [Vega-Lite](https://vega.github.io/vega-lite/) (JSON) / [Vega-Altair](https://altair-viz.github.io/) (Python) which offer a high-level grammar for interactive graphics. NB: Choosing a tool that uses high-level grammar will constrain the extent of customizations you can do with your interactive visualization.

## Dataset

Use a dataset of your choice. You are welcome to use the ones below, some are from previous exercises:

- [IMDB movies](https://www.kaggle.com/datasets/harshitshankhdhar/imdb-dataset-of-top-1000-movies-and-tv-shows) (csv)
- [Spotify](https://www.kaggle.com/datasets/zaheenhamidani/ultimate-spotify-tracks-db) (csv)
- [Titanic](https://www.kaggle.com/datasets/titanic) (csv)
- [Bergen weather](https://www.kaggle.com/datasets) (measured near the Florida bybane station) (csv)

You're also welcome to use your own dataset, provided it enables you to meet the exercise criteria (e.g., export a CSV file of your own health activity data from Garmin's website). If you're not sure, please discuss with me. Visualization is more fun when you have a personal interest in the data.

## Your task

You will create an interactive visualization that facilitates understanding of a question you find interesting to explore, in a dataset of your choice. You may create a single visualization that is interactive, or multiple visualizations that are linked through interactivity. Do not try to convey EVERYTHING in your data — focus on the subset of data that are useful in answering your question.

To determine what subset of the data is actually interesting, you can do some [exploratory analysis](https://en.wikipedia.org/wiki/Exploratory_data_analysis) of the data first for yourself. Use the outcome of this process to decide what to focus on for this exercise.

Be mindful about what interactions you include! There IS a cognitive cost to every interaction you add (nothing is free) so don't just throw the whole kitchen sink at this problem. Just as in visual design, every interaction design choice you make should be well-considered and well-justified, both in the realization and in your rationale write-up. You might find it helpful to design with Shneiderman's mantra in mind: "Overview first, zoom and filter, details on demand."

Here are some interaction techniques you can include (though you should not try to do everything here!):

- Zoom
- Pan
- Brush
- Filter
- Highlight
- Details-on-demand (e.g., tooltips)
- Widgets / dynamic query filters like legends, radio buttons, sliders

## Your rationale will include:

- the specific question that the visualization aims to answer, and how you thought about using visualization to answer this question. What tasks do you want the user to achieve?
- describe and justify each of your design decisions, considering both the visual design AND the interaction design.
- reflect on the trade-offs of both the visual and interactive design — what aspects of data are obscured? What are possible cognitive costs?
- **Note:** If you fell short of what you wanted to achieve, write about it anyway! It's completely fine to submit sketches and ideas of where you wanted to go, but did not manage to implement for whatever reason.
- be around **250–300 words**

## Resources

- [Plot interaction features](https://observablehq.com/plot/interaction/input)
- [Plot Lesson on Interaction](https://observablehq.com/plot/interaction/input)
- [D3 interaction documentation](https://d3js.org/d3 Brush)
- [Brushing to filter and zoom using D3 brush](https://observablehq.com/@d3/brushing-to-filter) (guest post on Observable)
- [D3 zoomable area chart](https://observablehq.com/@d3/zoomable-area-chart)
- [D3 dispatch code example](https://observablehq.com/@d3/dispatch)

## Submission Details

This assignment is **due on MittUiB by 11 Feb at 23:59**. Late submissions, as discussed in the syllabus, will be deducted accordingly.

This is an **individual** exercise. You may ask for help and discuss with your classmates, but each submission should be your own work. If you submit work that is identical to someone else's, you will receive a 0 for this assignment.

To be considered for full points **(5pts)**, you must do the following:

### (3pts) Implementation

Submit your implementation of this assignment in Plot or D3. Either as a link to your Observable notebook (don't forget to share link as unlisted), OR a ZIP file containing the code file(s) + data file + instructions (readme) for running your code and displaying the visualization.

**Breakdown of the 3pts:**

- (1pt) Visualization includes a title with a clear question that is being asked, axis labels, and other necessary text to be able to read the visual effectively
- (1pt) Data to visual mappings are sensible to the data characteristics
- (1pt) Interaction design choices facilitates a better understanding of the question being asked in the title
- **Note:** Use of Plot's auto mark or direct chart import does not score points for this assignment (0/3pts).

### (2pt) Rationale

Submit your rationale as a discussion post here. See this page for what is considered a good discussion post.

**NB: (+1 bonus point)** Commenting on someone else's visualization will allocate you a maximum of one bonus credit that you can apply to any missed points in the Exercises portion of this course. Maybe their work caught your eye, or you'd like to give constructive (and kind) feedback. Your reply to their discussion post for this exercise must be made by **18 Feb 23:59** to be considered for a bonus credit.
