Exercise Description

For this exercise, you will create two visualizations from the same dataset: one should be an honest representation of the data, while the second should be intentionally misleading the user to think differently than what the data may actually be saying. Exercise your devious powers here, and try to go beyond the obvious/bad ways to mislead. Your goal is to try your best to trick the viewer, using the tools we have discussed this week for evil instead of good :-)

This exercise offers the possibility to explore a new visualization library: Data-Driven Documents (D3) Links to an external site.. D3 is one of the gold standards of visualization development and enables flexible design for bespoke visualizations, although it can come with a steep learning curve. Alternatively, you may stick with using Plot Links to an external site. for this exercise. It's easier to make visualizations with this library, with the tradeoff being fewer possibilities for customization.
Dataset

You may use any dataset that you like; the constraint is that you use the SAME dataset for BOTH of your visualizations. You're welcome to find your own dataset, else below are some options for you to use. Many other data sources are also available from fivethirtyeight Links to an external site..

    IMDB movies dataset Links to an external site. (csv Download csv)
    Spotify dataset Links to an external site. (csv Download csv)
    Last week's sunshine dataset (csv Download csv)

Your task

Your task is to create two non-interactive visualizations (each a single chart) of your chosen dataset. One visualization should aim to effectively and honestly communicate some message about the data, while the other should aim to mislead the viewer to draw the wrong conclusion(s). This misleading should be happening at the level of the visualization--do not manipulate the underlying data! You will also write a short rationale that describes your design choices for both visualizations.
What are some design strategies for good and evil?

For this exercise, I consider an honest visualization to be one where:

    the visual is clear and understandable to a lay audience
    the visual encodings are appropriate and effective for the intended task
    data transformations and/or filters are clearly and transparently communicated
    underlying data source(s) and potential biases are communicated

Conversely, a deceptive visualization may be one where:

    the visual is intentionally vague, unclear, or misleading
    titles, legends, labels are designed to skew the viewer's perception of the information
    visual design choices result in difficulty reading the visualization (e.g., heavy/many grid lines, excessive design elements--remember, in code you can place images or other decorator elements onto the visualization)
    data are transformed or filtered in an (intentionally) misleading way
    data source and any possible bias is unclear

For both visualizations, start with a question that you would like to answer. Design your visualization to answer that question correctly (the honest vis) and incorrectly (the deceptive vis). It's fine to address a different question for each visualization. Be sure to document your question somewhere in your design, e.g., through title, caption, other labels, legend, as well as your rationale.

For the honest visualization, your goal is to be as clear and as transparent as possible to help viewers answer the question that you set out to visualize for them. For the deceptive visualization, your goal is to trick the viewer (including me!) into believing that the visualization is legitimate and honest. It should NOT be immediately obvious which visualization is the deceptive one! Subtle, ineffective design choices require attention to be identified--exercise your powers for evil here!

Remember that misleading strategies at the representation or visualization level are fine, but outright lying is not. Don't use sketchy datasets or manipulate the data itself (i.e., change numbers to create new outliers). Misleading by omission, filtering, or transformation of trustworthy data is fine. Avoid deliberate lies in the title, labels, legends--stick to facts that are technically true. Struggling to be evil? You can get some ideas from this sartorial paper on Visualization for Villany Links to an external site..
Your rationale will include:

    the specific question that each visualization aims to answer
    how you thought about using visualization to try to answer your question. What story were you trying to tell about the data? 
    describe and justify each of your design decisions. How did you try to be honest vs. deceptive? Try to be thorough, going beyond just the chart selection and down to details like color, shape, size, etc. of each data item shown on the screen.
    referring to readings on color and interaction, how might you add these aspects to make your visualization (even more) honest or misleading?
    be around 300 words 

Getting started with D3

To help you get started with D3's syntax, here is a demo file Download demo file that asks a question about the Spotify dataset Download Spotify dataset. For your exercise, you should be asking a DIFFERENT question than the demo. Consider other chart types appropriate to YOUR question(s), and consider the various channels that lead to a chart as we have discussed in class. For more guidance on working with D3, see this list of resources:

    D3 tutorials by its creator Mike Bostock, such as Let's make a bar chart Links to an external site. are a great place to start!
    An in-depth D3 introduction
    video Links to an external site.
    D3 Graph Gallery Links to an external site. by Data-to-Viz for understanding how to specify different plots with D3. They have a decision tree of charts by data type.
    Amelia Wattenberger created a comprehensive and helpful resource for D3 Links to an external site. and wrote a great book about it: Fullstack Data Visualization with D3 Links to an external site.

Submission Details

This assignment is due on MittUiB by 04 Feb at 23:59pm. Late submissions, as discussed in the syllabus, will be deducted accordingly.

This is an individual exercise. You may ask for help and discuss with your classmates, but each submission should be your own work. If you submit work that is identical to someone else's, you will receive a 0 for this assignment.

To be considered for full points (5pts), you must do the following:

    (3pts) Submit your implementation of this assignment in Plot or D3. Either as a link to your Observable notebook (don't forget to share link as unlisted), OR a ZIP file containing the code file(s) + data file + instructions (readme) for running your code on my computer.
    Breakdown of the 3pts:
        (1.5pt) the honest visualization uses the strategies listed above to be clear and understanding for a lay audience
        (1.5pt) the deceptive visualization uses the strategies listed above to be intentionally misleading (without lying outright or manipulating the underlying data)
        Note: Use of Plot's auto mark or direct chart import does not score points for this assignment (0/3pts).
    (2pt) Submit your rationale as a discussion post here. See this page for what is considered a good discussion post. 

NB: (+1 bonus point) Commenting on someone else's visualization will allocate you a maximum of one bonus credit that you can apply to any missed points in the Exercises portion of this course.  Maybe their work caught your eye, or you'd like to give constructive (and kind) feedback. Your reply to their discussion post for this exercise must be made by 11 Feb 23:59 to be considered for a bonus credit. 