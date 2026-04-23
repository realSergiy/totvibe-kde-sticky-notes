# SPDX-License-Identifier: GPL-3.0-or-later
FROM debian:trixie-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      qt6-declarative-dev-tools \
      qml6-module-qtcore \
      qml6-module-qttest \
      qml6-module-qtqml-models \
      qml6-module-org-kde-kirigami \
 && rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/lib/qt6/bin:${PATH}"
ENV QT_QPA_PLATFORM=offscreen
WORKDIR /work
