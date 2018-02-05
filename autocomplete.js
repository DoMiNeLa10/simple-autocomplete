/*exported Autocompleter */

const Autocompleter = (() => {
  "use strict";

  const includes = (array, element) => {
    for (const key of array) {
      if (key === element) {    // won't work with NaNs but it's close enough
        return true;
      }
    }
    return false;
  };

  const keys = Object.seal({
    upArrow:    38,
    downArrow:  40,
    leftArrow:  37,
    rightArrow: 39,
    enter:      13,
    tab:         9,
    escape:     27,
  });

  return class Autocompleter {
    constructor (
      {container,
       completions = [],
       options = {},
       callback = (result) => console.error(
         `Autocompleter: "${result}" picked (no callback specified)`)}) {

      if (container.tagName !== "DIV") {
        throw new Error("Specified container isn't a <div> element.");
      }

      // make an options object with defaults
      this.options = Object.assign({
        caseInsensitive: false,
        resultLimit: 0,
        emptyPlaceholder: "this should be overriden",
        highlightClass: "bugMeBecauseThisClassDoesNotExist",
        focus: false,
        onlyKnownCompletions: true,
      }, options);

      // create elements
      let inputElement = document.createElement("input"),
          completionElement = document.createElement("ul");

      inputElement.setAttribute("placeholder", this.options.emptyPlaceholder);

      [inputElement, completionElement].forEach(
        (element) => container.appendChild(element));

      if (this.options.focus) {
        inputElement.focus();
      }

      // store passed arguments in the created object
      this.inputElement = inputElement;
      this.completionElement = completionElement;
      this.completions = completions;
      this.callback = callback;

      // initialize internal state variables
      this.selectedCompletion = -1;
      this.visibleResults = [];
      this.lastInput = "";
      this.lastResults = [];

      // hook events and do the initial search
      window.addEventListener("keydown", (e) => this.keydownHandler(e));
      window.addEventListener("keyup", (e) => this.keyupHandler(e));
      this.redisplay();
    }

    updateCompletions (newCompletions = []) {
      this.completions = newCompletions;
      this.redisplay();
    }

    clearInput () {
      this.inputElement.value = "";
      this.redisplay();
    }

    clearCompletions (element = this.completionElement) {
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    }

    clearSelection () {
      this.selectedCompletion = -1;
    }

    getOptionElement (index = this.selectedCompletion) {
      if (index !== -1) {
        return this.completionElement.children[index];
      } else {
        return null;
      }
    }

    selectOption (index = this.selectedCompletion) {
      if (index !== -1) {
        this.getOptionElement(index)
          .classList.add(this.options.highlightClass);
      }
    }

    deselectOption (index = this.selectedCompletion) {
      if (index !== -1) {
        this.getOptionElement(index)
          .classList.remove(this.options.highlightClass);
      }
    }

    completeToSelectedOption (index = this.selectedCompletion) {
      if (index !== -1) {
        let text = this.getOptionText(index);
        this.inputElement.value = text;
        this.redisplay();
        return text;
      } else {
        return this.inputElement.value;
      }
    }

    getOptionText (index = this.selectedCompletion) {
      if (index !== -1) {
        return this.getOptionElement(index).firstChild.textContent;
      } else {
        return false;
      }
    }

    changeOption (offset) {
      if (this.visibleResults.length < 1) {
        // do nothing when there are no completions displayed
        return;
      }

      const firstIndex = 0,
            lastIndex = this.visibleResults.length - 1;

      if (this.selectedCompletion < firstIndex) {
        // no option was chosen before, select the appropriate one and
        // highlight it
        if (offset > 0) {
          this.selectedCompletion = firstIndex;
        } else {
          this.selectedCompletion = lastIndex;
        }

        this.selectOption(this.selectedCompletion);
      } else {
        const oldIndex = this.selectedCompletion;

        this.selectedCompletion += offset;

        if (this.selectedCompletion > lastIndex ||
            this.selectedCompletion < firstIndex) {
          // went past the boundary, so it's necessary to back off
          this.selectedCompletion = oldIndex;
          return;
        } else {
          this.deselectOption(oldIndex);
          this.selectOption(this.selectedCompletion);
        }
      }
    }

    isInFocus (element = this.inputElement) {
      return document.activeElement === element;
    }

    keyupHandler (event) {
      if (this.isInFocus()) {
        switch (event.which) {
          case keys.upArrow:
            this.changeOption(-1);
            break;
          case keys.downArrow:
            this.changeOption(1);
            break;
          case keys.enter:
            if (this.options.onlyKnownCompletions) {
              if (includes(this.completions, this.inputElement.value)) {
                this.callback(this.inputElement.value);
              } else if (this.visibleResults.length > 0) {
                this.callback(this.visibleResults[
                  (this.selectedCompletion === -1
                   ? 0
                   : this.selectedCompletion)]);
              }
            } else {
              if (this.inputElement.value === this.getOptionText()) {
                this.callback(this.inputElement.value);
              } else {
                this.callback(this.completeToSelectedOption());
              }
            }
            break;
          case keys.escape:
            this.clearInput();
            break;
          default:
            this.redisplay();
            break;
        }
      }
    }

    keydownHandler (event) {
      if (this.isInFocus()) {
        switch (event.which) {
          case keys.tab:
            this.completeToSelectedOption();
            // make sure input element doesn't go out of focus
            event.preventDefault();
            break;
        }
      }
    }

    redisplay () {
      this.displayResults(this.getCompletions());
    }

    displayResults (results = [], limit = this.options.resultLimit) {
      this.clearCompletions();
      this.clearSelection();

      this.visibleResults = ((limit > 0)
                             ? results.slice(0, limit)
                             : results.slice());
      // Clone the Array regardless, because storing a refenrence is way too
      // risky.

      this.visibleResults.forEach(
        (result, index) => {
          let cell = document.createElement("li");
          cell.appendChild(document.createTextNode(result));
          this.completionElement.appendChild(cell);
          cell.addEventListener("click",
                                () => this.callback(
                                  this.completeToSelectedOption(index)));
        });
    }

    getCompletions (input = this.inputElement.value,
                    completions = this.completions,
                    caseInsensitive = this.options.caseInsensitive) {
      if (input.length !== 0) {
        if (caseInsensitive) {
          input = input.toLowerCase();
        }

        const isIncremental =
              (this.lastInput.length !== 0 &&
               input.length > this.lastInput.length &&
               input.indexOf(this.lastInput) === 0);

        const result =
              (isIncremental
               ? this.lastResults
               : this.completions)
              .filter(caseInsensitive
                      ? (option) => option.toLowerCase().indexOf(input) !== -1
                      : (option) => option.indexOf(input) !== -1)
              .sort((a, b) => Math.sign(a.length - b.length));

        this.lastInput = input;
        this.lastResults = result;

        return result;
      } else {
        return completions;
      }
    }
  };
})();
