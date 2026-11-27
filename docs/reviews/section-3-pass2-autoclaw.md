You are implementing Phase 1 of plans/07-mobile-e2e-testing-infrastructure/plan.md for the SparkPlayer mobile app.

Follow strict TDD and engineering standards. All commands run in /Users/moeini/Dev/spot.

Tasks to implement in Phase 1:
1. Task 1.1: Ensure tests/mobile-e2e/ is a fully working Flutter package (pubspec.yaml with name: spot_mobile_e2e, dependencies patrol: ^4.10.0, dio: ^5.7.0, mobile: { path: ../../apps/mobile }, lib/spot_mobile_e2e.dart, .gitignore ignoring reports/, README.md). Verify `cd tests/mobile-e2e && flutter pub get && flutter analyze`.
2. Task 1.2: Make apps/mobile environment-configurable for real E2E:
   - Create apps/mobile/lib/core/config/app_config.dart:
     Class AppConfig with fields: apiBaseUrl (String), e2eResetToken (String?), useInMemoryDb (bool), isE2E (bool).
     AppConfig.fromEnvironment() reading:
       API_BASE_URL (defaults to 'https://api.spotplayer.local/api/v1')
       E2E_RESET_TOKEN (String.fromEnvironment('E2E_RESET_TOKEN'))
       USE_IN_MEMORY_DB (bool.fromEnvironment('USE_IN_MEMORY_DB', defaultValue: false))
       IS_E2E (bool.fromEnvironment('IS_E2E', defaultValue: false))
   - Update apps/mobile/lib/app.dart:
     SpotApp should accept optional `AppConfig? config`, plus optional `apiClient`, `database`, `secureVault`.
     Crucial: SpotApp should NOT recreate database, secureVault, or apiClient on every widget rebuild! State management or StatefulWidget/lazy initialization must retain the instances across widget rebuilds so DB and vault are preserved.
     If useInMemoryDb is true or in test mode, uses memory DB; otherwise uses NativeDatabase(file) or configured DB.
   - Update apps/mobile/lib/main.dart to pass `AppConfig.fromEnvironment()`.
   - Update apps/mobile/lib/features/1_courses_list/courses_list_screen.dart:
     In _showAddLicenseDialog(), replace hardcoded 'mock-hwid' and 'android' with:
       hwid = await DeviceHwid.getOrGenerateHwid(widget.secureVault);
       osFamily = Platform.isIOS ? 'ios' : 'android';
       deviceName = Platform.isIOS ? 'iPhone' : 'Android Device';
   - Write RED test first: apps/mobile/test/core/app_config_test.dart testing AppConfig.fromEnvironment(), SpotApp config retention across rebuilds, and CoursesListScreen real HWID/OS resolution.
   - Make it GREEN.
3. Task 1.3: Centralize Stable Widget Keys Across All 6 Screens:
   - Create apps/mobile/lib/core/testing/widget_keys.dart with static const Key constants:
     - CoursesListScreen:
       coursesAddLicenseBtn = Key('courses.add_license_btn') (also keep or alias Key('add_license_button') for backwards compat if existing tests use it)
       coursesDownloadsBtn = Key('courses.downloads_btn')
       coursesSettingsBtn = Key('courses.settings_btn')
       coursesSearchInput = Key('courses.search_input')
       coursesEmptyState = Key('courses.empty_state')
       static Key courseItem(int courseId) => Key('courses.item_${courseId}');
     - Add License Dialog:
       licenseDialogInput = Key('license_dialog.input')
       licenseDialogSubmitBtn = Key('license_dialog.submit_btn') (alias Key('submit_license_button') if needed)
       licenseDialogCancelBtn = Key('license_dialog.cancel_btn')
       licenseDialogErrorSnackbar = Key('license_dialog.error_snackbar')
     - ChaptersListScreen:
       chaptersList = Key('chapters.list')
       static Key chapterItem(int sectionId) => Key('chapters.item_${sectionId}');
     - LessonsListScreen:
       lessonsList = Key('lessons.list')
       static Key lessonItem(int lessonId) => Key('lessons.item_${lessonId}');
       static Key lessonDownloadBtn(int lessonId) => Key('lessons.download_btn_${lessonId}');
       static Key lessonOfflineBadge(int lessonId) => Key('lessons.offline_badge_${lessonId}');
     - VideoPlayerScreen:
       playerSurface = Key('player.surface')
       playerWatermarkOverlay = Key('player.watermark_overlay')
       playerPlayPauseBtn = Key('player.play_pause_btn')
       playerSpeedBtn = Key('player.speed_btn')
     - PdfViewerScreen:
       pdfViewer = Key('pdf.viewer')
       pdfWatermarkOverlay = Key('pdf.watermark_overlay')
     - DownloadsScreen & SettingsScreen:
       downloadsList = Key('downloads.list')
       settingsLocaleToggle = Key('settings.locale_toggle')
       settingsDeviceInfo = Key('settings.device_info')
   - Attach these keys to all 6 screens in apps/mobile/lib/features/**.
   - Write RED test: apps/mobile/test/features/widget_keys_coverage_test.dart testing the presence of these keys across the screens.
   - Make it GREEN. Ensure all existing tests in apps/mobile/test/ still pass.
4. Task 1.4: Retire Maestro Stub:
   - Remove apps/mobile/maestro/flow_activate_download_play.yaml and remove directory apps/mobile/maestro.
   - Update apps/mobile/README.md to reference Patrol and tests/mobile-e2e/.

Verification:
- Run `cd apps/mobile && flutter test && flutter analyze`
- Run `cd tests/mobile-e2e && flutter test && flutter analyze`
Ensure 0 errors and all tests pass.