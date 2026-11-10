# Briefs

One brief per piece of work, written before the work starts. A brief is one page:

- **Goal.** What a reader or the owner can do afterwards that they cannot do now.
- **In.** What the pull request delivers.
- **Out.** What it leaves for later, so the scope is not argued in review.
- **Checks.** How to tell it is done: commands that pass, pages to look at, numbers to meet.
- **Open questions.** Anything the owner has to decide first. Empty when the work can start.

Name a brief `NN-short-name.md`, numbered in order. The owner edits or approves it, then one pull
request implements it and repeats the checks in its description. A decision that outlives the
brief goes into `../DECISIONS.md`. A finished brief stays as a record and is not updated.
