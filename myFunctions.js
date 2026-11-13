/* ==========================================================================
   myFunctions.js
   جميع توابع JavaScript/jQuery المستخدمة في موقع مكتب النور لتأجير السيارات
   المادة: تصميم وتطوير تطبيقات الوب — IWB201
   ========================================================================== */

(function ($) {
  "use strict";

  /* ------------------------------------------------------------------------
     ثوابت عامة
     ------------------------------------------------------------------------ */
  var SETTINGS = {
    currency: "ل.س",
    discountRate: 0.05,      // نسبة الخصم 5%
    discountAfterDays: 10    // يُطبَّق الخصم عند تجاوز هذه المدة
  };

  var ARABIC_LETTERS = /^[\u0621-\u0652\u0670\u0640]+(?:\s+[\u0621-\u0652\u0670\u0640]+)*$/;
  var NATIONAL_ID = /^(0[1-9]|1[0-4])\d{9}$/;
  var MOBILE = /^09[3-9]\d{7}$/;
  var EMAIL = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
  var ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

  /* ------------------------------------------------------------------------
     1) توابع مساعدة عامة (نصوص وأرقام وتواريخ)
     ------------------------------------------------------------------------ */

  // إزالة الفراغات من البداية والنهاية
  function trim(value) {
    return String(value == null ? "" : value).replace(/^\s+|\s+$/g, "");
  }

  // إبقاء الأرقام فقط
  function digits(value) {
    return String(value == null ? "" : value).replace(/[^\d]/g, "");
  }

  // تنسيق الأرقام بفواصل الآلاف: 1234567 -> 1,234,567
  function formatNumber(number) {
    var n = Math.round(Number(number) || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // رقم مقروء مع اسم العملة
  function formatMoney(number) {
    return formatNumber(number) + " " + SETTINGS.currency;
  }

  // استخراج رقم من نص مثل "250,000 ل.س / يوم"
  function parseNumber(text) {
    return parseInt(digits(text), 10) || 0;
  }

  // هل التاريخ موجود فعلاً في التقويم؟ (yyyy-mm-dd)
  function isValidDate(value) {
    var match = ISO_DATE.exec(trim(value));
    if (!match) {
      return false;
    }
    var year = parseInt(match[1], 10);
    var month = parseInt(match[2], 10);
    var day = parseInt(match[3], 10);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
  }

  // تحويل yyyy-mm-dd إلى ميلي ثانية (UTC) لتجنّب فروق التوقيت
  function dateToMillis(value) {
    var match = ISO_DATE.exec(trim(value));
    if (!match) {
      return NaN;
    }
    return Date.UTC(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  }

  // عدد الأيام بين تاريخين: الفرق بين تاريخ النهاية وتاريخ البداية
  function daysBetween(start, end) {
    var diff = dateToMillis(end) - dateToMillis(start);
    return Math.round(diff / 86400000);
  }

  // تاريخ اليوم بصيغة yyyy-mm-dd
  function todayISO() {
    var now = new Date();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    return now.getFullYear() + "-" + (month < 10 ? "0" + month : month) + "-" + (day < 10 ? "0" + day : day);
  }

  // تنظيف نص قبل إدراجه في HTML
  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // صيغة عربية سليمة لعدد الأيام: يوم واحد / يومان / 5 أيام / 12 يوماً
  function daysLabel(days) {
    if (days === 1) {
      return "يوم واحد";
    }
    if (days === 2) {
      return "يومان";
    }
    if (days >= 3 && days <= 10) {
      return days + " أيام";
    }
    return days + " يوماً";
  }

  // رقم طلب تسلسلي بسيط
  function makeReference() {
    var now = new Date();
    var serial = String(now.getHours()) + String(now.getMinutes()) + String(now.getSeconds());
    return "CR-" + now.getFullYear() + "-" + serial;
  }

  /* ------------------------------------------------------------------------
     2) قواعد التحقق من صحة المدخلات
     ------------------------------------------------------------------------ */

  // الاسم: أحرف عربية فقط (ويقبل الفراغ بين الكلمات)، والقيمة الفارغة مسموحة
  function isValidName(value) {
    var text = trim(value);
    return text.length >= 3 && ARABIC_LETTERS.test(text);
  }

  // الرقم الوطني: 11 خانة، أول خانتان رمز محافظة بين 01 و14
  function isValidNationalId(value) {
    return NATIONAL_ID.test(digits(value));
  }

  // تطبيع رقم الموبايل: يقبل +963/00963 ويحوّلها إلى الصيغة المحلية 09xxxxxxxx
  function normalizeMobile(value) {
    var text = digits(value);
    if (text.indexOf("00963") === 0) {
      text = "0" + text.slice(5);
    } else if (text.indexOf("963") === 0 && text.length === 12) {
      text = "0" + text.slice(3);
    }
    return text;
  }

  // الموبايل السوري: Syriatel أو MTN (09 + رقم من 3 إلى 9 + 7 أرقام)
  function isValidMobile(value) {
    return MOBILE.test(normalizeMobile(value));
  }

  function isValidEmail(value) {
    return EMAIL.test(trim(value));
  }

  /* ------------------------------------------------------------------------
     3) سيارات الجدول والاختيار
     ------------------------------------------------------------------------ */

  // قراءة السيارات المختارة من الجدول (الرمز، الاسم، السنة، السعر)
  function getSelectedCars() {
    var cars = [];
    $("input[name='selectedCars']:checked").each(function () {
      var code = this.value;
      var $row = $("#row-" + code);
      cars.push({
        code: code,
        model: trim($row.find(".model-name").text()),
        year: trim($row.find(".year").text()),
        price: parseNumber($row.find(".price-cell b").text())
      });
    });
    return cars;
  }

  // تحديث شريط الاختيار السفلي (العدد + مجموع الأسعار اليومية)
  function updateSelectionBar() {
    var cars = getSelectedCars();
    var daily = 0;
    $.each(cars, function (index, car) {
      daily += car.price;
    });
    $("#selectedCount").text(cars.length);
    $("#dailyTotal").text(formatNumber(daily));
    $(".car-row").removeClass("is-selected");
    $.each(cars, function (index, car) {
      $("#row-" + car.code).addClass("is-selected");
    });
    renderPickedCars(cars);
  }

  // عرض السيارات المختارة داخل النموذج
  function renderPickedCars(cars) {
    var $box = $("#pickedCars");
    if (!$box.length) {
      return;
    }
    $box.empty();
    if (!cars.length) {
      $box.append('<span class="picked-empty">لم يتم اختيار أي سيارة بعد.</span>');
      return;
    }
    $.each(cars, function (index, car) {
      var $item = $('<span class="picked-item"></span>');
      $item.append($("<span></span>").text(car.model + " — " + formatMoney(car.price) + " / يوم"));
      $item.append('<span class="x">&#215;</span>');
      $box.append($item);
    });
  }

  // إظهار/إخفاء صف التفاصيل (يمكن فتح عدة صفوف في الوقت نفسه)
  function toggleDetails(code, shouldOpen) {
    var $row = $("#detailsRow-" + code);
    var $inner = $row.find(".details-inner");
    $inner.stop(true, true);
    if (shouldOpen) {
      $row.addClass("is-open");
      $inner.hide().slideDown(200);
    } else {
      $inner.slideUp(160, function () {
        $row.removeClass("is-open");
      });
    }
  }

  // الانتقال إلى الخطوة الثانية: إظهار النموذج والتمرير إليه
  function openBookingForm() {
    var $booking = $("#booking");
    if (!$booking.length) {
      return;
    }
    $booking.addClass("is-open");
    $(".steps .step").removeClass("is-active").eq(1).addClass("is-active");
    $("html, body").animate({
      scrollTop: $booking.offset().top - 86
    }, 480);
  }

  /* ------------------------------------------------------------------------
     4) التحقق من النموذج
     ------------------------------------------------------------------------ */

  // تعريف الحقول: المعرّف + إلزامي أم لا + دالة التحقق
  function fieldDefinitions() {
    return [
      { id: "fullName", required: false, check: isValidName },
      { id: "nationalId", required: true, check: isValidNationalId },
      { id: "mobile", required: false, check: isValidMobile },
      { id: "email", required: false, check: isValidEmail },
      { id: "startDate", required: true, check: isValidDate },
      { id: "endDate", required: true, check: isValidDate }
    ];
  }

  // حالة الحقل: خطأ / صحيح / محايد
  function setFieldState($input, state) {
    var $field = $input.closest(".field");
    $field.removeClass("has-error is-valid");
    if (state === "error") {
      $field.addClass("has-error");
    } else if (state === "valid") {
      $field.addClass("is-valid");
    }
    $field.find(".error-msg").toggleClass("is-visible", state === "error");
  }

  // رسالة خطأ مخصّصة لحقل ما
  function setErrorMessage($input, message) {
    var $message = $input.closest(".field").find(".error-msg");
    if (message) {
      $message.text(message);
    }
  }

  // التحقق من حقل واحد؛ يعيد true إذا كانت القيمة مقبولة
  function validateField(definition, silent) {
    var $input = $("#" + definition.id);
    if (!$input.length) {
      return true;
    }
    var raw = $input.val();
    var value = trim(raw);

    // حقول اختيارية وفارغة: لا خطأ ولا علامة صح
    if (!definition.required && value === "") {
      if (!silent) {
        setFieldState($input, "neutral");
      }
      return true;
    }

    var valid = value !== "" && definition.check(value);
    if (!valid && !silent) {
      setFieldState($input, "error");
    } else if (valid && !silent) {
      setFieldState($input, "valid");
    }
    return valid;
  }

  // التحقق من الحقلين المتتاليين: تاريخ النهاية بعد تاريخ البداية
  function validateDateOrder(silent) {
    var $start = $("#startDate");
    var $end = $("#endDate");
    if (!$start.length || !$end.length) {
      return true;
    }
    var start = trim($start.val());
    var end = trim($end.val());
    if (!isValidDate(start) || !isValidDate(end)) {
      return true; // خطأ الصيغة يعالجه التحقق العام
    }
    if (daysBetween(start, end) < 1) {
      if (!silent) {
        setFieldState($end, "error");
        setErrorMessage($end, "تاريخ النهاية يجب أن يكون لاحقاً لتاريخ البداية.");
      }
      return false;
    }
    if (!silent) {
      setFieldState($end, "valid");
    }
    return true;
  }

  // التحقق من النموذج كاملاً؛ يعيد أول حقل غير صالح أو null
  function validateBookingForm() {
    var invalid = null;
    $.each(fieldDefinitions(), function (index, definition) {
      if (!validateField(definition, true)) {
        var $input = $("#" + definition.id);
        setFieldState($input, "error");
        if (definition.id === "endDate" && isValidDate(trim($("#startDate").val())) && isValidDate(trim($("#endDate").val()))) {
          setErrorMessage($input, "تاريخ النهاية يجب أن يكون لاحقاً لتاريخ البداية.");
        }
        if (!invalid) {
          invalid = $input;
        }
      }
    });
    if (!invalid && !validateDateOrder(false)) {
      invalid = $("#endDate");
    }
    return invalid;
  }

  /* ------------------------------------------------------------------------
     5) الحسابات المالية
     ------------------------------------------------------------------------ */

  // حساب مدة التأجير والمجاميع والخصم
  function calculateRental(cars, days) {
    var subtotal = 0;
    var rows = [];
    $.each(cars, function (index, car) {
      var lineTotal = car.price * days;
      subtotal += lineTotal;
      rows.push({
        code: car.code,
        model: car.model,
        year: car.year,
        price: car.price,
        days: days,
        total: lineTotal
      });
    });
    var discount = days > SETTINGS.discountAfterDays ? Math.round(subtotal * SETTINGS.discountRate) : 0;
    return {
      days: days,
      rows: rows,
      subtotal: subtotal,
      discount: discount,
      total: subtotal - discount
    };
  }

  /* ------------------------------------------------------------------------
     6) بناء نافذة النتيجة
     ------------------------------------------------------------------------ */

  function buildResultHTML(rental, customer) {
    var html = [];

    html.push('<div class="dialog-meta">');
    html.push("<div>مقدّم الطلب: <b>" + escapeHTML(customer.name || "غير مُدخل") + "</b></div>");
    html.push("<div>الرقم الوطني: <b>" + escapeHTML(customer.nationalId) + "</b></div>");
    html.push("<div>تاريخ البداية: <b>" + escapeHTML(customer.start) + "</b></div>");
    html.push("<div>تاريخ النهاية: <b>" + escapeHTML(customer.end) + "</b></div>");
    html.push("<div>مدة التأجير: <b>" + daysLabel(rental.days) + "</b></div>");
    html.push("<div>عدد السيارات: <b>" + rental.rows.length + "</b></div>");
    html.push("</div>");

    html.push('<table class="summary-table">');
    html.push("<thead><tr>");
    html.push("<th scope=\"col\">السيارة</th>");
    html.push('<th scope="col" class="num">السعر اليومي</th>');
    html.push('<th scope="col" class="num">عدد الأيام</th>');
    html.push('<th scope="col" class="num">المجموع</th>');
    html.push("</tr></thead><tbody>");

    $.each(rental.rows, function (index, row) {
      html.push("<tr>");
      html.push("<td>" + escapeHTML(row.model) + " <span class=\"code\">" + escapeHTML(row.code) + "</span></td>");
      html.push('<td class="num">' + formatNumber(row.price) + "</td>");
      html.push('<td class="num">' + row.days + "</td>");
      html.push('<td class="num">' + formatNumber(row.total) + "</td>");
      html.push("</tr>");
    });

    html.push("</tbody></table>");

    html.push('<div class="totals">');
    html.push('<div class="total-row"><span>المجموع قبل الخصم</span><b>' + formatMoney(rental.subtotal) + "</b></div>");
    html.push('<div class="total-row"><span>الخصم (5% على المدة التي تتجاوز 10 أيام)</span><b>' +
      (rental.discount > 0 ? "- " + formatMoney(rental.discount) : "0 " + SETTINGS.currency) + "</b></div>");
    html.push('<div class="total-row grand"><span>المبلغ الإجمالي المستحق</span><b>' + formatMoney(rental.total) + "</b></div>");
    html.push("</div>");

    if (rental.discount > 0) {
      html.push('<div class="discount-note">تم تطبيق خصم 5% لأن مدة التأجير (' + daysLabel(rental.days) +
        ") تجاوزت 10 أيام.</div>");
    } else {
      html.push('<div class="discount-note is-off">لم يُطبَّق الخصم: مدة التأجير ' + daysLabel(rental.days) +
        "، ويُطبَّق الخصم عند تجاوز 10 أيام.</div>");
    }

    return html.join("");
  }

  function openResultDialog(rental, customer) {
    $("#resultRef").text("رقم الطلب: " + makeReference() + " — " + customer.start + " حتى " + customer.end);
    $("#resultContent").html(buildResultHTML(rental, customer));
    $("#resultOverlay").addClass("is-open");
    $("body").addClass("has-result").css("overflow", "hidden");
    $(".steps .step").removeClass("is-active").eq(2).addClass("is-active");
    $("#closeResult").trigger("focus");
  }

  function closeResultDialog() {
    $("#resultOverlay").removeClass("is-open");
    $("body").removeClass("has-result").css("overflow", "");
    $(".steps .step").removeClass("is-active").eq(0).addClass("is-active");
    $("#submitBtn").trigger("focus");
  }

  /* ------------------------------------------------------------------------
     7) ربط الأحداث عند جهوزية الصفحة
     ------------------------------------------------------------------------ */

  $(function () {

    /* --- 7.1 حقول التاريخ: إدخال نصي بصيغة yyyy-mm-dd مع إضافة الشرطات ------
       لا يعرف XHTML 1.0 Strict النوع type="date"، لذلك نعتمد حقلاً نصياً
       ونضيف الشرطات تلقائياً أثناء الكتابة، ثم نتحقق من صحة التاريخ. */
    var $dateInputs = $("#startDate, #endDate");
    $dateInputs.on("input", function () {
      var raw = digits(this.value).substring(0, 8);
      var formatted = raw.substring(0, 4);
      if (raw.length > 4) {
        formatted += "-" + raw.substring(4, 6);
      }
      if (raw.length > 6) {
        formatted += "-" + raw.substring(6, 8);
      }
      this.value = formatted;
    });

    // نصوص إرشادية داخل الحقول (تُضاف عبر JavaScript حفاظاً على صحة XHTML)
    $("#fullName").attr("placeholder", "محمد أحمد العلي");
    $("#nationalId").attr("placeholder", "01123456789");
    $("#mobile").attr("placeholder", "0932111222");
    $("#email").attr("placeholder", "name@example.com");
    $("#startDate").attr("placeholder", "2026-11-20");
    $("#endDate").attr("placeholder", "2026-11-27");

    /* --- 7.2 تأثيرات عامة: ظل الترويسة وزر العودة للأعلى ------------------- */
    var $header = $("#siteHeader");
    function onScroll() {
      var top = $(window).scrollTop();
      $header.toggleClass("is-scrolled", top > 6);
      $("#toTop").toggleClass("is-visible", top > 480);
    }
    $(window).on("scroll", onScroll);
    onScroll();

    $("#toTop").on("click", function () {
      $("html, body").animate({ scrollTop: 0 }, 420);
    });

    /* --- 7.3 صفحة "من نحن": أسئلة شائعة قابلة للفتح والإغلاق --------------- */
    $("#faq .faq-q").on("click", function () {
      var $item = $(this).closest(".faq-item");
      var $answer = $item.find(".faq-a");
      if ($item.hasClass("is-open")) {
        $answer.stop(true, true).slideUp(170);
        $item.removeClass("is-open");
      } else {
        $answer.stop(true, true).slideDown(200);
        $item.addClass("is-open");
      }
    });

    /* --- 7.4 صفحة السيارات: عرض التفاصيل ---------------------------------- */
    $("input[id^='details-']").on("change", function () {
      var code = this.id.replace("details-", "");
      toggleDetails(code, this.checked);
    });

    /* --- 7.5 اختيار السيارات وتحديث شريط الاختيار -------------------------- */
    $("input[name='selectedCars']").on("change", function () {
      $("#selectAlert").removeClass("is-visible");
      updateSelectionBar();
    });

    $("#selectAll").on("click", function () {
      $("input[name='selectedCars']").prop("checked", true).trigger("change");
    });

    $("#clearAll, #resetSelection").on("click", function () {
      $("input[name='selectedCars']").prop("checked", false).trigger("change");
    });

    $("#continueBtn").on("click", function () {
      var cars = getSelectedCars();
      if (!cars.length) {
        var $alert = $("#selectAlert");
        $alert.addClass("is-visible");
        var $table = $(".table-scroll");
        $table.stop(true, true).css("transform", "translateX(0)");
        // اهتزازة خفيفة تنبّه المستخدم
        $table.animate({ marginRight: "-6px" }, 60)
          .animate({ marginRight: "6px" }, 60)
          .animate({ marginRight: "-3px" }, 60)
          .animate({ marginRight: "0px" }, 60);
        $("html, body").animate({
          scrollTop: $alert.offset().top - 120
        }, 300);
        return;
      }
      openBookingForm();
    });

    /* --- 7.6 التحقق الفوري أثناء الكتابة ---------------------------------- */
    $.each(fieldDefinitions(), function (index, definition) {
      var $input = $("#" + definition.id);
      $input.on("blur", function () {
        validateField(definition, false);
        if (definition.id === "startDate" || definition.id === "endDate") {
          validateDateOrder(false);
        }
      });
      $input.on("input", function () {
        var $field = $input.closest(".field");
        if ($field.hasClass("has-error")) {
          $field.removeClass("has-error");
          $field.find(".error-msg").removeClass("is-visible");
        }
      });
    });

    // منع كتابة أحرف في حقلي الرقم الوطني والموبايل
    $("#nationalId, #mobile").on("keypress", function (event) {
      var charCode = event.which ? event.which : event.keyCode;
      if (charCode > 31 && (charCode < 48 || charCode > 57) && charCode !== 43) {
        return false;
      }
      return true;
    });

    /* --- 7.7 إرسال النموذج ------------------------------------------------ */
    $("#bookingForm").on("submit", function (event) {
      event.preventDefault();

      var cars = getSelectedCars();
      if (!cars.length) {
        $("#selectAlert").addClass("is-visible");
        $("html, body").animate({ scrollTop: $("#selectAlert").offset().top - 120 }, 300);
        return;
      }

      var $invalid = validateBookingForm();
      if ($invalid && $invalid.length) {
        var $field = $invalid.closest(".field");
        $field.addClass("has-error");
        $field.find(".error-msg").addClass("is-visible");
        $("html, body").animate({ scrollTop: $field.offset().top - 140 }, 320);
        $invalid.trigger("focus");
        return;
      }

      var customer = {
        name: trim($("#fullName").val()),
        nationalId: digits($("#nationalId").val()),
        mobile: normalizeMobile($("#mobile").val()),
        email: trim($("#email").val()),
        start: trim($("#startDate").val()),
        end: trim($("#endDate").val())
      };

      var days = daysBetween(customer.start, customer.end);
      var rental = calculateRental(cars, days);
      openResultDialog(rental, customer);
    });

    /* --- 7.8 إغلاق نافذة النتيجة ----------------------------------------- */
    $("#closeResult, #closeResult2").on("click", closeResultDialog);

    $("#resultOverlay").on("click", function (event) {
      if (event.target === this) {
        closeResultDialog();
      }
    });

    $(document).on("keydown", function (event) {
      if (event.key === "Escape" && $("#resultOverlay").hasClass("is-open")) {
        closeResultDialog();
      }
    });

    $("#printResult").on("click", function () {
      window.print();
    });

    /* --- 7.9 تفريغ النموذج ----------------------------------------------- */
    $("#bookingForm").on("reset", function () {
      $(".field").removeClass("has-error is-valid");
      $(".error-msg").removeClass("is-visible");
      window.setTimeout(function () {
        updateSelectionBar();
        $("input[name='selectedCars']").trigger("change");
      }, 0);
    });

    /* --- 7.10 تهيئة أولية ------------------------------------------------- */
    updateSelectionBar();

    // واجهة للاختبار الآلي والتوثيق (ليست ضرورية لعمل الموقع)
    window.CarRentalApp = {
      settings: SETTINGS,
      isValidName: isValidName,
      isValidNationalId: isValidNationalId,
      isValidMobile: isValidMobile,
      isValidEmail: isValidEmail,
      isValidDate: isValidDate,
      daysBetween: daysBetween,
      calculateRental: calculateRental,
      getSelectedCars: getSelectedCars,
      formatNumber: formatNumber,
      todayISO: todayISO
    };
  });

}(jQuery));
