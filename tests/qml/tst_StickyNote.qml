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
            property string noteId: ""
            property url notesDirUrl: ""

            source: Qt.resolvedUrl("../../package/contents/ui/StickyNote.qml")
            onLoaded: {
                item.noteId = noteId;
                item.notesDirUrl = notesDirUrl;
            }
        }
    }

    function test_placeholder_when_unbound() {
        const loader = createTemporaryObject(stickyComponent, testCase, {
            noteId: "",
            notesDirUrl: ""
        });
        verify(loader, "loader created");
        tryCompare(loader, "status", Loader.Ready);
        tryCompare(loader.item, "missing", true);
        compare(loader.item.content, "");
    }

    function test_renders_fixture_when_bound() {
        const loader = createTemporaryObject(stickyComponent, testCase, {
            noteId: "fixture-note",
            notesDirUrl: Qt.resolvedUrl("./fixtures")
        });
        verify(loader, "loader created");
        tryCompare(loader, "status", Loader.Ready);
        tryCompare(loader.item, "missing", false, 2000);
        verify(loader.item.content.indexOf("fixture body") >= 0, "content contains fixture body, got: " + loader.item.content);
    }
}
