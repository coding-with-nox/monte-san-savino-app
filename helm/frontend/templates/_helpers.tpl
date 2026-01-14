{{- define "miniatures-contest-frontend.name" -}}
miniatures-contest-frontend
{{- end -}}

{{- define "miniatures-contest-frontend.fullname" -}}
{{ .Release.Name }}-{{ include "miniatures-contest-frontend.name" . }}
{{- end -}}
