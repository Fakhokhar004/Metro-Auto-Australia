if (!customElements.get("make-model-year-search")) {
  customElements.define(
    "make-model-year-search",
    class YearSearch extends HTMLElement {
      constructor() {
        super();
        this.getFilterURL = "";
        this.makeFilter = this.querySelector(".select__make_data");
        this.makeFilter?.addEventListener(
          "change",
          this.getModelData.bind(this)
        );
        this.modelStoreData = "";
        this.modelFilter = this.querySelector(".select__model_data");
        this.modelFilter?.addEventListener(
          "change",
          this.getYearData.bind(this)
        );
        this.yearStoreData = "";
        this.yearFilter = this.querySelector(".select__year_data");
        this.yearFilter?.addEventListener(
          "change",
          this.getEngineData.bind(this)
        );
        this.engineStoreData = "";
        this.engineFilter = this.querySelector(".select__engine_data");
        this.engineFilter?.addEventListener(
          "change",
          this.submitEngineData.bind(this)
        );
        this.searchURL = this.querySelector(".search__url");
        this.initMakeFilter();
      }

      // Get initial Make data
      initMakeFilter() {
        fetch(`/collections/all?view=search`)
          .then((response) => response.text())
          .then((response) => {
            let parser = new DOMParser(),
              newHTMlData = parser.parseFromString(response, "text/html"),
              getSelectValues = newHTMlData.querySelector(".select__make_data"),
              uniqueSelectDataList = [];

            for (var i = 0, n = getSelectValues.options.length; i < n; i++) {
              if (getSelectValues.options[i].value)
                uniqueSelectDataList.push(getSelectValues.options[i].value);
            }

            let uniqueDataArray = uniqueSelectDataList.filter(
              (item, index, arr) => {
                return arr.indexOf(item) == index;
              }
            );

            let initialData = `<option value="select">${window.advanceSearch.field_label_1}</option>`;

            uniqueDataArray.forEach((option) => {
              initialData += `<option value="${option}">${option}</option>`;
            });

            this.makeFilter.innerHTML = initialData;
          })
          .catch((err) => console.log(err));
      }

      // Get Model data
      getModelData(e) {
        let selectMakeValue =
          this.makeFilter.options[this.makeFilter.selectedIndex].value;
        if (selectMakeValue == "select") {
          if (this.modelFilter !== null) {
            this.modelFilter.disabled = true;
          }
          if (this.yearFilter !== null) {
            this.yearFilter.disabled = true;
          }
          if (this.engineFilter !== null) {
            this.engineFilter.disabled = true;
          }
        } else {
          if (this.yearFilter !== null) {
            this.yearFilter.disabled = true;
          }
          if (this.engineFilter !== null) {
            this.engineFilter.disabled = true;
          }
          this.modelStoreData = selectMakeValue;

          this.getFilterURL = `/collections/all?filter.p.m.make.key_make=${selectMakeValue}`;

          console.log(this.searchURL);

          this.searchURL.setAttribute("href", this.getFilterURL);

          fetch(
            `/collections/all?filter.p.m.make.key_make=${selectMakeValue}&view=search`
          )
            .then((response) => response.text())
            .then((response) => {
              let parser = new DOMParser(),
                newHTMlData = parser.parseFromString(response, "text/html"),
                getSelectValues = newHTMlData.querySelector(
                  ".select__model_data"
                ),
                uniqueSelectDataList = [];

              for (var i = 0, n = getSelectValues.options.length; i < n; i++) {
                if (getSelectValues.options[i].value)
                  uniqueSelectDataList.push(getSelectValues.options[i].value);
              }

              let uniqueDataArray = uniqueSelectDataList.filter(
                (item, index, arr) => {
                  return arr.indexOf(item) == index;
                }
              );

              let initialData = `<option value="select">${window.advanceSearch.field_label_2}</option>`;

              uniqueDataArray.forEach((option) => {
                initialData += `<option value="${option}">${option}</option>`;
              });
              if (this.modelFilter !== null) {
                this.modelFilter.innerHTML = initialData;
                this.modelFilter.disabled = false;
              }
            })
            .catch((err) => console.log(err));
        }
      }

      // Get Year data
      getYearData(e) {
        let selectModelValue =
          this.modelFilter.options[this.modelFilter.selectedIndex].value;
        if (selectModelValue == "select") {
          if (this.yearFilter !== null) {
            this.yearFilter.disabled = true;
          }
          if (this.engineFilter !== null) {
            this.engineFilter.disabled = true;
          }
        } else {
          if (this.engineFilter !== null) {
            this.engineFilter.disabled = true;
          }
          this.yearStoreData = selectModelValue;

          this.getFilterURL = `/collections/all?filter.p.m.model.key_model=${selectModelValue}&filter.p.m.make.key_make=${this.modelStoreData}`;
          this.searchURL.setAttribute("href", this.getFilterURL);

          fetch(
            `/collections/all?filter.p.m.model.key_model=${selectModelValue}&filter.p.m.make.key_make=${this.modelStoreData}&view=search`
          )
            .then((response) => response.text())
            .then((response) => {
              let parser = new DOMParser(),
                newHTMlData = parser.parseFromString(response, "text/html"),
                getSelectValues =
                  newHTMlData.querySelector(".select__year_data"),
                uniqueSelectDataList = [];

              for (var i = 0, n = getSelectValues.options.length; i < n; i++) {
                if (getSelectValues.options[i].value)
                  uniqueSelectDataList.push(getSelectValues.options[i].value);
              }

              let uniqueDataArray = uniqueSelectDataList.filter(
                (item, index, arr) => {
                  return arr.indexOf(item) == index;
                }
              );

              let initialData = `<option value="select">${window.advanceSearch.field_label_3}</option>`;

              uniqueDataArray.forEach((option) => {
                initialData += `<option value="${option}">${option}</option>`;
              });

              if (this.yearFilter !== null) {
                this.yearFilter.innerHTML = initialData;
                this.yearFilter.disabled = false;
              }
            })
            .catch((err) => console.log(err));
        }
      }

      // Get Engin data
      getEngineData(e) {
        let selectYearValue =
          this.yearFilter.options[this.yearFilter.selectedIndex].value;
        if (selectYearValue == "select") {
          if (this.engineFilter !== null) {
            this.engineFilter.disabled = true;
          }
        } else {
          this.engineStoreData = selectYearValue;

          this.getFilterURL = `/collections/all?filter.p.m.year.key_year=${selectYearValue}&filter.p.m.model.key_model=${this.yearStoreData}&filter.p.m.make.key_make=${this.modelStoreData}`;
          this.searchURL.setAttribute("href", this.getFilterURL);

          fetch(
            `/collections/all?filter.p.m.year.key_year=${selectYearValue}&filter.p.m.model.key_model=${this.yearStoreData}&filter.p.m.make.key_make=${this.modelStoreData}&view=search`
          )
            .then((response) => response.text())
            .then((response) => {
              let parser = new DOMParser(),
                newHTMlData = parser.parseFromString(response, "text/html"),
                getSelectValues = newHTMlData.querySelector(
                  ".select__engine_data"
                ),
                uniqueSelectDataList = [];

              for (var i = 0, n = getSelectValues.options.length; i < n; i++) {
                if (getSelectValues.options[i].value)
                  uniqueSelectDataList.push(getSelectValues.options[i].value);
              }

              let uniqueDataArray = uniqueSelectDataList.filter(
                (item, index, arr) => {
                  return arr.indexOf(item) == index;
                }
              );

              let initialData = `<option value="select">${window.advanceSearch.field_label_4}</option>`;

              uniqueDataArray.forEach((option) => {
                initialData += `<option value="${option}">${option}</option>`;
              });

              if (this.engineFilter !== null) {
                this.engineFilter.innerHTML = initialData;
                this.engineFilter.disabled = false;
              }
            })
            .catch((err) => console.log(err));
        }
      }

      // Submit Engine Data
      submitEngineData(e) {
        let selectEngineValue =
          this.engineFilter.options[this.engineFilter.selectedIndex].value;
        this.getFilterURL = `/collections/all?filter.p.m.engine.key_engine=${selectEngineValue}&filter.p.m.year.key_year=${this.engineStoreData}&filter.p.m.model.key_model=${this.yearStoreData}&filter.p.m.make.key_make=${this.modelStoreData}`;
        this.searchURL.setAttribute("href", this.getFilterURL);
      }
    }
  );
}
