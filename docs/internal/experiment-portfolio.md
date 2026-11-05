# Experiment portfolio

Open **Experiments** and select **Portfolio** above the list to review experiments grouped by lifecycle status. Select **List** to return to the table.

The portfolio uses the same search, status, creator, archived filter, and pagination as the list. Groups describe the experiments on the current page, rather than totals across the project. The `view=portfolio` URL parameter preserves the view when sharing or refreshing the page.

Each experiment links to its detail page. Where supported results are available, the portfolio shows its first primary metric and variant performance using the same calculations and formatting as the experiment results page. It does not combine metrics or infer a conclusion from an experiment's lifecycle status.

Draft experiments do not request results. Experiments without a configured primary metric, legacy metrics, and results that cannot be loaded provide a link to the experiment for further review. A result loading failure does not prevent other experiments from appearing.

Result requests are limited in concurrency. Opening the list view does not request portfolio results.
