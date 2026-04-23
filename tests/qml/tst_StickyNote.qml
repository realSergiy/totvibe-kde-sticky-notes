// SPDX-License-Identifier: GPL-3.0-or-later
import QtQuick
import QtTest

TestCase {
    id: testCase

    name: "StickyNote"
    when: windowShown
    width: 240
    height: 200

    Component {
        id: stickyComponent

        Loader {
            property string testNoteId: ""
            property url testNotesDirUrl: ""

            source: Qt.resolvedUrl("../../package/contents/ui/StickyNote.qml")
            onLoaded: {
                item.noteId = testNoteId;
                item.notesDirUrl = testNotesDirUrl;
            }
        }
    }

    function makeSticky(id, dirUrl) {
        const loader = createTemporaryObject(stickyComponent, testCase, {
            testNoteId: id,
            testNotesDirUrl: dirUrl
        });
        verify(loader, "loader created");
        tryCompare(loader, "status", Loader.Ready);
        return loader.item;
    }

    function test_missing_when_unbound() {
        const sticky = makeSticky("", "");
        tryCompare(sticky, "missing", true);
        compare(sticky.content, "");
        compare(sticky.mode, "view");
    }

    function test_renders_fixture_when_bound() {
        const sticky = makeSticky("fixture-note", Qt.resolvedUrl("./fixtures"));
        tryCompare(sticky, "missing", false, 2000);
        verify(sticky.content.indexOf("fixture body") >= 0, "content contains fixture body, got: " + sticky.content);
        compare(sticky.mode, "view");
    }

    function test_empty_note_auto_enters_edit() {
        const sticky = makeSticky("empty-note", Qt.resolvedUrl("./fixtures"));
        tryCompare(sticky, "missing", false, 2000);
        tryCompare(sticky, "mode", "edit", 2000);
    }

    function test_enter_edit_then_commit_cycles_mode() {
        const sticky = makeSticky("fixture-note", Qt.resolvedUrl("./fixtures"));
        tryCompare(sticky, "missing", false, 2000);
        compare(sticky.mode, "view");
        sticky.enterEdit();
        compare(sticky.mode, "edit");
        sticky.commit();
        tryCompare(sticky, "mode", "view", 2000);
    }

    function test_enter_edit_is_noop_when_missing() {
        const sticky = makeSticky("does-not-exist", Qt.resolvedUrl("./fixtures"));
        tryCompare(sticky, "missing", true, 2000);
        sticky.enterEdit();
        compare(sticky.mode, "view");
    }

    function test_discard_edit_returns_to_view() {
        const sticky = makeSticky("fixture-note", Qt.resolvedUrl("./fixtures"));
        tryCompare(sticky, "missing", false, 2000);
        sticky.enterEdit();
        compare(sticky.mode, "edit");
        sticky.discardEdit();
        tryCompare(sticky, "mode", "view", 2000);
        compare(sticky.staleExternal, false);
    }
}
